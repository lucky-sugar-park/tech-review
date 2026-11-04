package com.techreview.rag;

import com.techreview.common.Cli;
import com.techreview.common.Ollama;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.Set;
import java.util.function.Consumer;

/**
 * 증분 인덱싱 시나리오 데모 (demo_scenario.py의 Java 버전): 문서가 바뀔 때 인덱스가 어떻게 따라가는지 순서대로 보여준다.
 * sources/를 workspace/로 복사해서 작업하므로 원본 샘플은 바뀌지 않는다.
 */
public final class DemoScenario {
    static final Path WORK = Path.of("workspace", "scenario");

    private DemoScenario() {}

    static void showSearch(Connection c, String query, String docType) throws Exception {
        System.out.println("  🔎 \"" + query + "\"");
        for (Search.Hit h : Search.search(query, 2, docType, null, c).hits()) {
            String t = h.text.replace("\n", " ");
            System.out.println("     → " + h.title + " · " + h.revision + " · " + h.headingPath);
            System.out.println("       " + t.substring(0, Math.min(110, t.length())));
        }
    }

    static void edit(Path path, String old, String neu) throws Exception {
        String text = Files.readString(path);
        if (!text.contains(old)) {
            throw new IllegalStateException(path + ": '" + old + "'를 찾지 못함");
        }
        Files.writeString(path, text.replace(old, neu), StandardCharsets.UTF_8);
    }

    public static void main(String[] args) throws Exception {
        Cli cli = new Cli(args, Set.of());
        String model = cli.flag("--offline") ? RagKit.OFFLINE_MODEL : RagKit.EMBED_MODEL;
        boolean pause = cli.flag("--pause");
        BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));

        Evaluate.deleteTree(WORK);
        Path src = WORK.resolve("sources");
        Evaluate.copyTree(Indexer.SOURCE_DIR, src, rel -> rel.startsWith("converted") || rel.toString().endsWith(".enrich.json"));
        Indexer.chunkerVersion = "md-heading-v1";
        try (Connection c = RagKit.connect(WORK.resolve("index.db"))) {
            int[] n = {0};
            Consumer<String> step = title -> {
                if (pause && n[0] > 0) {
                    System.out.print("\n  (Enter를 누르면 다음 단계)");
                    try {
                        stdin.readLine();
                    } catch (Exception ignored) {
                        // 입력 없음
                    }
                }
                n[0]++;
                System.out.println("\n━━ " + n[0] + ". " + title + " " + "━".repeat(Math.max(0, 50 - title.length())));
            };

            step.accept("처음 색인: 모든 문서를 변환·청킹·임베딩");
            Indexer.run(src, model, false, false, false, c, System.out::println);
            showSearch(c, "B-205 볼트 체결 토크", null);

            step.accept("다시 실행: 바뀐 것이 없으면 아무것도 하지 않는다");
            Indexer.run(src, model, false, false, false, c, System.out::println);

            step.accept("작업표준서 개정 (Rev.3 → Rev.4, 체결 토크 9.0 → 9.5 N·m)");
            Path wi = src.resolve("standards").resolve("wi-assy2-b205.md");
            edit(wi, "revision: Rev.3", "revision: Rev.4");
            for (String old : new String[]{"체결 토크는 9.0 N·m이다", "설정값을 9.0 N·m로", "9.0 ± 0.5 N·m"}) {
                edit(wi, old, old.replace("9.0", "9.5"));
            }
            Indexer.run(src, model, false, false, false, c, System.out::println);
            showSearch(c, "B-205 볼트 체결 토크", null);

            step.accept("DB에 불량 사례 1건 추가 (행 1건 = 문서 1건)");
            Files.writeString(src.resolve("db").resolve("defect_cases.csv"), "DC-1028,2026-10-28,사출2라인,3호기,C-310,흑점,외관면 흑점 0.5 mm,"
                    + "실린더 히터 단선(E-217)으로 수지 체류 탄화,히터 교체 및 실린더 퍼징,불량 해소,2026-10-29\n", StandardCharsets.UTF_8, StandardOpenOption.APPEND);
            Indexer.run(src, model, false, false, false, c, System.out::println);
            showSearch(c, "3호기 흑점 불량 원인", "불량 사례");

            step.accept("검사 기준서 폐기: 원본은 남지만 검색에서는 빠진다");
            edit(src.resolve("quality").resolve("inspection-c310.md"), "status: 유효", "status: 폐기");
            Indexer.run(src, model, false, false, false, c, System.out::println);
            showSearch(c, "C-310 버 합격 기준", null);

            step.accept("MES 매뉴얼 파일 삭제: 원천에서 사라진 문서는 인덱스에서도 삭제");
            Files.delete(src.resolve("manuals").resolve("mes-user-manual.md"));
            Indexer.run(src, model, false, false, false, c, System.out::println);

            step.accept("청킹 규칙을 바꾸면? (dry-run: 계획만)");
            Indexer.chunkerVersion = "md-heading-v2";
            Indexer.run(src, model, false, true, false, c, System.out::println);
            System.out.println("  → 설정이 바뀐 문서는 모두 다시 색인해야 한다. 운영에서는 새 인덱스를 옆에 만들고 전환한다 (README 참고)");

            System.out.println("\n실행 이력 (runs 테이블):");
            try (PreparedStatement ps = c.prepareStatement("SELECT run_id, added, updated, skipped, withdrawn, removed FROM runs");
                 ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    System.out.printf("  #%d: 추가 %d · 갱신 %d · 유지 %d · 폐기 %d · 삭제 %d%n", rs.getInt(1), rs.getInt(2), rs.getInt(3),
                            rs.getInt(4), rs.getInt(5), rs.getInt(6));
                }
            }
        } catch (Ollama.Unavailable e) {
            throw new Cli.Exit("❌ " + e.getMessage());
        }
    }
}
