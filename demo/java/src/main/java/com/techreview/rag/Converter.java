package com.techreview.rag;

import com.techreview.common.Cli;
import com.techreview.common.Json;
import com.techreview.common.Text;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import javax.xml.parsers.DocumentBuilderFactory;

/**
 * 원본 문서(DOCX·PPTX·TXT 등)를 인덱싱용 마크다운으로 변환한다 (convert.py의 Java 버전).
 *
 * 흐름:  raw/ 원본 ──▶ 변환 ──▶ 후처리 ──▶ 앞머리 메타데이터 ──▶ 품질 점검 ──▶ sources/converted/*.md ──▶ index
 *
 * - JDK만으로(zip + XML) DOCX(제목 스타일·표·목록), PPTX(슬라이드·표·발표자 노트), TXT(cp949 판별, 머리말·쪽번호 제거)를 처리한다.
 *   Docling·MarkItDown은 파이썬 라이브러리라 Java 버전에는 없다. 필요하면 파이썬 convert.py를 쓰거나 docling-serve(REST)를 호출한다.
 * - 구형 DOC·PPT는 LibreOffice(soffice)로 DOCX·PPTX로 바꾼 뒤 변환한다. HWP는 한컴오피스에서 DOCX·PDF로 변환해 둔다.
 * - 원본 해시를 앞머리에 기록해 두고 원본이 바뀐 파일만 다시 변환한다. 원본이 사라지면 변환본도 지운다.
 */
public final class Converter {
    public static final Path RAW_DIR = RagKit.BASE.resolve("raw");
    public static final Path OUT_DIR = RagKit.BASE.resolve("sources").resolve("converted");
    static final Set<String> SUPPORTED = Set.of(".docx", ".pptx", ".txt", ".md", ".pdf", ".xlsx", ".doc", ".ppt", ".hwp", ".hwpx");
    static final Map<String, String> FOLDER_TYPES = Map.of("standards", "작업표준서", "training", "교육 자료", "notices", "공지",
            "equipment", "설비 매뉴얼", "quality", "검사 기준", "manuals", "MES 매뉴얼");   // 폴더 이름으로 문서 유형 추정
    static final String W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    static final String A = "http://schemas.openxmlformats.org/drawingml/2006/main";
    static final String P = "http://schemas.openxmlformats.org/presentationml/2006/main";
    static final String DC = "http://purl.org/dc/elements/1.1/";

    /** 변환 중 모은 통계 (품질 점검용). */
    static final class Stats {
        int tables;
        List<Integer> imageOnlySlides = new ArrayList<>();
        String title = "";
    }

    record Converted(String markdown, String engine, Stats stats, List<String> warnings) {}

    private Converter() {}

    static String mdTable(List<List<String>> rows) {
        List<List<String>> clean = rows.stream()
                .map(r -> r.stream().map(c -> c.replace("|", "/").replace("\n", " ").strip()).toList())
                .filter(r -> r.stream().anyMatch(c -> !c.isBlank())).toList();
        if (clean.isEmpty()) {
            return "";
        }
        int width = clean.stream().mapToInt(List::size).max().orElse(0);
        List<String> lines = new ArrayList<>();
        for (int i = 0; i < clean.size(); i++) {
            List<String> r = new ArrayList<>(clean.get(i));
            while (r.size() < width) {
                r.add("");
            }
            lines.add("| " + String.join(" | ", r) + " |");
            if (i == 0) {
                lines.add("| " + String.join(" | ", Collections.nCopies(width, "---")) + " |");
            }
        }
        return String.join("\n", lines);
    }

    // ── XML 도우미 ───────────────────────────────────────────────────────
    static Document xml(ZipFile z, String name) {
        try {
            ZipEntry e = z.getEntry(name);
            if (e == null) {
                return null;
            }
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            f.setNamespaceAware(true);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);   // XXE 방지
            return f.newDocumentBuilder().parse(z.getInputStream(e));
        } catch (Exception ex) {
            throw new IllegalStateException(name + " 읽기 실패: " + ex.getMessage(), ex);
        }
    }

    static List<Element> all(Node root, String ns, String local) {
        NodeList nl = root instanceof Document d ? d.getElementsByTagNameNS(ns, local) : ((Element) root).getElementsByTagNameNS(ns, local);
        List<Element> out = new ArrayList<>();
        for (int i = 0; i < nl.getLength(); i++) {
            out.add((Element) nl.item(i));
        }
        return out;
    }

    static String texts(Node root, String ns) {
        return all(root, ns, "t").stream().map(Node::getTextContent).collect(Collectors.joining());
    }

    // ── 내장 변환기 (JDK) ─────────────────────────────────────────────────
    static Converted builtinDocx(Path path) throws IOException {
        Stats st = new Stats();
        List<String> out = new ArrayList<>();
        try (ZipFile z = new ZipFile(path.toFile())) {
            Document doc = xml(z, "word/document.xml");
            Map<String, String> styles = new HashMap<>();
            Document sx = xml(z, "word/styles.xml");
            if (sx != null) {
                for (Element s : all(sx, W, "style")) {
                    List<Element> name = all(s, W, "name");
                    styles.put(s.getAttributeNS(W, "styleId"), name.isEmpty() ? "" : name.get(0).getAttributeNS(W, "val").toLowerCase());
                }
            }
            Element body = all(doc, W, "body").get(0);
            for (Node n = body.getFirstChild(); n != null; n = n.getNextSibling()) {
                if (!(n instanceof Element el) || !W.equals(el.getNamespaceURI())) {
                    continue;
                }
                if (el.getLocalName().equals("p")) {
                    String text = texts(el, W).strip();
                    if (text.isEmpty()) {
                        continue;
                    }
                    List<Element> ps = all(el, W, "pStyle");
                    String style = "";
                    if (!ps.isEmpty()) {
                        String id = ps.get(0).getAttributeNS(W, "val");
                        style = styles.getOrDefault(id, id.toLowerCase());
                    }
                    Matcher m = Pattern.compile("(?:heading|제목)\\s*(\\d)").matcher(style);
                    if (style.equals("title") || m.lookingAt()) {                   // Word의 제목 스타일 → #, ##
                        out.add("#".repeat(style.equals("title") ? 1 : Integer.parseInt(m.group(1))) + " " + text);
                    } else if (!all(el, W, "numPr").isEmpty() || style.startsWith("list")) {
                        out.add("- " + text);
                    } else {
                        out.add(text);
                    }
                } else if (el.getLocalName().equals("tbl")) {
                    st.tables++;
                    List<List<String>> rows = all(el, W, "tr").stream()
                            .map(tr -> all(tr, W, "tc").stream().map(tc -> texts(tc, W)).toList()).toList();
                    out.add(mdTable(rows));
                }
            }
            Document core = xml(z, "docProps/core.xml");
            if (core != null && !all(core, DC, "title").isEmpty()) {
                st.title = all(core, DC, "title").get(0).getTextContent().strip();
            }
        }
        return new Converted(String.join("\n\n", out), "builtin", st, new ArrayList<>());
    }

    static Converted builtinPptx(Path path) throws IOException {
        Stats st = new Stats();
        List<String> out = new ArrayList<>();
        try (ZipFile z = new ZipFile(path.toFile())) {
            Pattern slideName = Pattern.compile("ppt/slides/slide(\\d+)\\.xml");
            List<String> slides = z.stream().map(ZipEntry::getName).filter(n -> slideName.matcher(n).matches())
                    .sorted(Comparator.comparingInt(n -> {
                        Matcher m = slideName.matcher(n);
                        m.matches();
                        return Integer.parseInt(m.group(1));
                    })).toList();
            for (int i = 1; i <= slides.size(); i++) {
                String sn = slides.get(i - 1);
                Document root = xml(z, sn);
                String title = "";
                List<String> texts = new ArrayList<>();
                for (Element sp : all(root, P, "sp")) {
                    List<Element> ph = all(sp, P, "ph");
                    List<String> paras = all(sp, A, "p").stream().map(p -> texts(p, A).strip()).filter(t -> !t.isEmpty()).toList();
                    String type = ph.isEmpty() ? "" : ph.get(0).getAttribute("type");
                    if ((type.equals("title") || type.equals("ctrTitle")) && title.isEmpty()) {
                        title = String.join(" ", paras);
                    } else {
                        texts.addAll(paras);
                    }
                }
                List<String> tables = new ArrayList<>();
                for (Element tbl : all(root, A, "tbl")) {
                    st.tables++;
                    tables.add(mdTable(all(tbl, A, "tr").stream().map(tr -> all(tr, A, "tc").stream().map(tc -> texts(tc, A)).toList()).toList()));
                }
                int pics = all(root, P, "pic").size();
                String notes = "";
                Document rels = xml(z, sn.replace("slides/", "slides/_rels/") + ".rels");
                if (rels != null) {
                    NodeList rl = rels.getDocumentElement().getChildNodes();
                    for (int k = 0; k < rl.getLength(); k++) {
                        if (rl.item(k) instanceof Element rel && rel.getAttribute("Target").contains("notesSlide")) {
                            String target = rel.getAttribute("Target");
                            Document nd = xml(z, "ppt/notesSlides/" + target.substring(target.lastIndexOf('/') + 1));
                            for (Element sp : nd == null ? List.<Element>of() : all(nd, P, "sp")) {
                                List<Element> ph = all(sp, P, "ph");
                                if (!ph.isEmpty() && ph.get(0).getAttribute("type").equals("body")) {
                                    notes = all(sp, A, "p").stream().map(p -> texts(p, A)).collect(Collectors.joining(" ")).strip();
                                }
                            }
                        }
                    }
                }
                List<String> block = new ArrayList<>();
                block.add("## 슬라이드 " + i + (title.isEmpty() ? "" : ": " + title));   // 슬라이드 1장 = 섹션 1개
                texts.forEach(t -> block.add("- " + t));
                block.addAll(tables);
                if (pics > 0 && texts.isEmpty() && tables.isEmpty()) {
                    block.add("(그림 " + pics + "개, 텍스트 없음)");
                    st.imageOnlySlides.add(i);
                }
                if (!notes.isEmpty()) {
                    block.add("**발표자 노트:** " + notes);
                }
                out.add(String.join("\n\n", block));
                if (i == 1 && !title.isEmpty()) {
                    st.title = title;                                               // 첫 슬라이드 제목 = 문서 제목
                }
            }
        }
        return new Converted(String.join("\n\n", out), "builtin", st, new ArrayList<>());
    }

    /** 국내 PC의 TXT는 cp949(EUC-KR)인 경우가 많다. UTF-8로 안 읽히면 MS949로 읽는다. */
    static String readText(Path path) throws IOException {
        byte[] raw = Files.readAllBytes(path);
        for (Charset cs : List.of(StandardCharsets.UTF_8, Charset.forName("MS949"))) {
            try {
                String s = cs.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
                        .decode(ByteBuffer.wrap(raw)).toString();
                return s.startsWith("﻿") ? s.substring(1) : s;
            } catch (CharacterCodingException ignored) {
                // 다음 인코딩 시도
            }
        }
        return new String(raw, StandardCharsets.UTF_8);
    }

    static Converted builtinTxt(Path path) throws IOException {
        String text = readText(path).replace("\r\n", "\n");
        String[] pages = text.split("\f");
        Map<String, Integer> firsts = new HashMap<>();
        for (String p : pages) {
            if (!p.isBlank()) {
                firsts.merge(p.strip().split("\n")[0].strip(), 1, Integer::sum);
            }
        }
        Set<String> repeated = new HashSet<>();                                    // 페이지마다 반복되는 머리말
        firsts.forEach((k, v) -> {
            if (v >= 2) {
                repeated.add(k);
            }
        });
        Pattern pageNo = Pattern.compile("[-–]?\\s*\\d+\\s*[-–]?|page \\d+|\\d+\\s*/\\s*\\d+", Pattern.CASE_INSENSITIVE);
        List<String> out = new ArrayList<>();
        for (String page : pages) {
            for (String ln : page.split("\n")) {
                String s = ln.strip();
                if (s.isEmpty() || repeated.contains(s) || pageNo.matcher(s).matches()) {
                    continue;                                                       // 빈 줄, 머리말, 페이지 번호 제거
                }
                if (s.matches("^\\d+\\.\\d+\\.?\\s+\\S.*")) {
                    out.add("### " + s);                                            // 1.1 → ###
                } else if (s.matches("^\\d+\\.\\s+\\S.*")) {
                    out.add("## " + s);                                             // 1.  → ##
                } else if (s.matches("^[가-하]\\.\\s+\\S.*")) {
                    out.add("- " + s);                                              // 가. → 목록
                } else {
                    out.add(s);
                }
            }
        }
        if (!out.isEmpty() && !out.get(0).startsWith("#")) {
            out.set(0, "# " + out.get(0));                                          // 첫 줄을 문서 제목으로
        }
        String md = String.join("\n\n", out).replaceAll("\n\n(- )", "\n$1");
        return new Converted(md, "builtin", new Stats(), new ArrayList<>());
    }

    /** 구형 DOC·PPT를 LibreOffice로 DOCX·PPTX로 바꾼다. 없으면 null. */
    static Path legacyToOoxml(Path path, Path tmp) throws IOException, InterruptedException {
        String target = Indexer.suffix(path.getFileName().toString()).equals(".doc") ? "docx" : "pptx";
        for (String exe : List.of("soffice", "libreoffice")) {
            try {
                Process p = new ProcessBuilder(exe, "--headless", "--convert-to", target, "--outdir", tmp.toString(), path.toString())
                        .redirectErrorStream(true).start();
                p.getInputStream().readAllBytes();
                p.waitFor();
                Path out = tmp.resolve(Indexer.stem(path) + "." + target);
                if (Files.exists(out)) {
                    return out;
                }
            } catch (IOException notInstalled) {
                // 다음 실행 파일 시도
            }
        }
        return null;
    }

    static Converted convertFile(Path path) throws Exception {
        String suffix = Indexer.suffix(path.getFileName().toString());
        Path tmp = Files.createTempDirectory("convert");
        try {
            List<String> warnings = new ArrayList<>();
            if (suffix.equals(".doc") || suffix.equals(".ppt")) {
                Path conv = legacyToOoxml(path, tmp);
                if (conv == null) {
                    throw new IllegalStateException("LibreOffice(soffice)가 없어 구형 문서를 변환할 수 없음");
                }
                warnings.add("LibreOffice로 " + Indexer.suffix(conv.getFileName().toString()) + " 변환 후 처리");
                path = conv;
                suffix = Indexer.suffix(path.getFileName().toString());
            }
            Converted c = switch (suffix) {
                case ".docx" -> builtinDocx(path);
                case ".pptx" -> builtinPptx(path);
                case ".txt", ".md" -> builtinTxt(path);
                case ".hwp", ".hwpx" -> throw new IllegalStateException("HWP는 한컴오피스에서 DOCX·PDF로 일괄 변환하거나 파이썬 convert.py(ureca_document_parser)를 쓰세요");
                default -> throw new IllegalStateException(suffix + "는 Java 내장 변환기가 지원하지 않음 (파이썬 convert.py의 Docling 사용)");
            };
            c.warnings().addAll(0, warnings);
            return c;
        } finally {
            try (var s = Files.walk(tmp)) {
                s.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
            }
        }
    }

    // ── 메타데이터, 품질 점검, 저장 ──────────────────────────────────────
    static Map<String, String> inferMeta(Path path, String md, Stats st, Path rawDir) throws IOException {
        Map<String, String> meta = new LinkedHashMap<>();
        Path sidecar = path.resolveSibling(path.getFileName() + ".meta.json");   // 옆 파일의 메타데이터가 최우선
        if (Files.exists(sidecar)) {
            Json.readMap(Files.readString(sidecar)).forEach((k, v) -> meta.put(k, String.valueOf(v)));
        }
        String stem = Indexer.stem(path);
        Matcher m = Pattern.compile("^([A-Z]{2,}(?:-[A-Z0-9]+)+)").matcher(stem);   // 파일명 규칙: 문서번호_Rev2
        meta.putIfAbsent("doc_id", m.find() ? m.group(1) : stem);
        Matcher rv = Pattern.compile("Rev\\.?\\s*(\\d+)", Pattern.CASE_INSENSITIVE).matcher(stem);
        meta.putIfAbsent("revision", rv.find() ? "Rev." + rv.group(1) : "-");
        Path rel = rawDir.relativize(path);
        meta.putIfAbsent("doc_type", rel.getNameCount() > 1 ? FOLDER_TYPES.getOrDefault(rel.getName(0).toString(), "일반") : "일반");
        Matcher h1 = Pattern.compile("(?m)^# (.+)$").matcher(md);
        meta.putIfAbsent("title", !st.title.isEmpty() ? st.title : h1.find() ? h1.group(1).strip() : stem);
        meta.putIfAbsent("status", "유효");
        return meta;
    }

    static List<String> qualityCheck(String md, Stats st) {
        List<String> issues = new ArrayList<>();
        String body = md.replaceAll("\\s", "");
        if (body.length() < 150) {
            issues.add("내용이 너무 짧음 (" + body.length() + "자)");
        }
        if (!Pattern.compile("(?m)^#{1,6} ").matcher(md).find()) {
            issues.add("제목 구조 없음 (청킹 품질 저하)");
        }
        if (st.tables > 0 && !md.contains("| --- |") && !md.replace(" ", "").contains("|---|")) {
            issues.add("표 누락 의심 (원본 표 " + st.tables + "개)");
        }
        if (!st.imageOnlySlides.isEmpty()) {
            issues.add("그림 위주 슬라이드 " + st.imageOnlySlides + " (설명 추가 필요)");
        }
        return issues;
    }

    static String frontMatter(Map<String, String> meta) {
        List<String> order = List.of("doc_id", "title", "doc_type", "revision", "status");
        List<String> keys = new ArrayList<>(order);
        meta.keySet().stream().filter(k -> !order.contains(k)).forEach(keys::add);
        return "---\n" + keys.stream().filter(k -> meta.get(k) != null && !meta.get(k).isEmpty())
                .map(k -> k + ": " + meta.get(k)).collect(Collectors.joining("\n")) + "\n---\n\n";
    }

    static String existingHash(Path out) throws IOException {
        if (!Files.exists(out)) {
            return null;
        }
        String head = Files.readString(out);
        Matcher m = Pattern.compile("(?m)^source_hash: (\\S+)$").matcher(head.substring(0, Math.min(2000, head.length())));
        return m.find() ? m.group(1) : null;
    }

    static String show(Path p) {
        Path base = RagKit.BASE.toAbsolutePath().normalize();
        Path abs = p.toAbsolutePath().normalize();
        return abs.startsWith(base) ? base.relativize(abs).toString().replace('\\', '/') : abs.toString();
    }

    public static Map<String, Integer> run(Path rawDir, Path outDir, boolean force, Consumer<String> out) throws IOException {
        Map<String, Integer> counts = new LinkedHashMap<>(Map.of("converted", 0, "skipped", 0, "removed", 0, "failed", 0));
        List<String> review = new ArrayList<>();
        Set<Path> seen = new HashSet<>();
        for (Path path : Indexer.walk(rawDir)) {
            String name = path.getFileName().toString();
            if (!SUPPORTED.contains(Indexer.suffix(name)) || name.startsWith("~$") || name.startsWith(".")) {
                continue;
            }
            String rel = rawDir.relativize(path).toString().replace('\\', '/');
            Path target = outDir.resolve(rel + ".md");
            seen.add(target.toAbsolutePath().normalize());
            Path sidecar = path.resolveSibling(name + ".meta.json");
            byte[] src = Files.readAllBytes(path);
            byte[] side = Files.exists(sidecar) ? Files.readAllBytes(sidecar) : new byte[0];
            byte[] both = new byte[src.length + side.length];
            System.arraycopy(src, 0, both, 0, src.length);
            System.arraycopy(side, 0, both, src.length, side.length);
            String srcHash = HexFormat.of().formatHex(Text.digest("SHA-256", both)).substring(0, 16);
            if (!force && srcHash.equals(existingHash(target))) {
                counts.merge("skipped", 1, Integer::sum);
                continue;
            }
            Converted c;
            try {
                c = convertFile(path);
            } catch (Exception e) {
                counts.merge("failed", 1, Integer::sum);
                out.accept("  ❌ 실패  " + rel + ": " + e.getMessage());
                continue;
            }
            String md = c.markdown().replaceAll("\n{3,}", "\n\n").strip() + "\n";
            md = md.replaceAll("(?m)^(- .*)\n\n(?=- )", "$1\n").replaceAll("(?m)^(- .*)\n\n(?=- )", "$1\n");   // 목록 사이 빈 줄 제거
            Map<String, String> meta = inferMeta(path, md, c.stats(), rawDir);
            List<String> issues = qualityCheck(md, c.stats());
            meta.put("source", "raw/" + rel);
            meta.put("source_hash", srcHash);
            meta.put("converter", "java-" + c.engine());
            meta.put("converted_at", LocalDateTime.now().truncatedTo(ChronoUnit.SECONDS).toString());
            if (!issues.isEmpty()) {
                meta.put("review", "필요 - " + String.join("; ", issues));
                review.add(rel + ": " + String.join("; ", issues));
            }
            if (!md.startsWith("# ")) {
                md = "# " + meta.get("title") + "\n\n" + md;
            }
            Files.createDirectories(target.getParent());
            Files.writeString(target, frontMatter(meta) + md, StandardCharsets.UTF_8);
            counts.merge("converted", 1, Integer::sum);
            out.accept("  📝 변환  " + rel + "  →  " + show(target) + "  [" + c.engine() + "]");
            c.warnings().forEach(w -> out.accept("           · " + w));
        }
        if (Files.isDirectory(outDir)) {                                            // 원본이 사라진 변환본 정리
            for (Path md : Indexer.walk(outDir)) {
                if (md.toString().endsWith(".md") && !seen.contains(md.toAbsolutePath().normalize())) {
                    Files.delete(md);
                    counts.merge("removed", 1, Integer::sum);
                    out.accept("  🗑  삭제  " + show(md) + " (원본 없음)");
                }
            }
        }
        out.accept(String.format("  ── 변환 %d · 유지 %d · 삭제 %d · 실패 %d", counts.get("converted"), counts.get("skipped"),
                counts.get("removed"), counts.get("failed")));
        if (!review.isEmpty()) {
            out.accept("  🔍 검수 필요:");
            review.forEach(r -> out.accept("     - " + r));
        }
        return counts;
    }

    public static void main(String[] args) throws Exception {
        Cli cli = new Cli(args, Set.of("--raw", "--out"));
        Path raw = Path.of(cli.opt("--raw", RAW_DIR.toString()));
        Path outDir = Path.of(cli.opt("--out", OUT_DIR.toString()));
        System.out.println("🔄 변환  " + raw + "  →  " + outDir + "  (변환기: java 내장)");
        run(raw, outDir, cli.flag("--force"), System.out::println);
    }
}
