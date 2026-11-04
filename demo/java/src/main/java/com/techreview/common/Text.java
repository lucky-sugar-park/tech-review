package com.techreview.common;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 해시, 숫자 추출, 토큰화 등 문자열 도우미. */
public final class Text {
    private static final Pattern INT_NUM = Pattern.compile("\\d[\\d,]*");
    private static final Pattern DEC_NUM = Pattern.compile("\\d[\\d,]*(?:\\.\\d+)?");
    private static final Pattern TOKEN = Pattern.compile("[0-9A-Za-z][0-9A-Za-z\\-.]*|[가-힣]+");
    private static final Pattern HANGUL = Pattern.compile("[가-힣]+");
    private static final Pattern THINK = Pattern.compile("<think>.*?</think>", Pattern.DOTALL);

    private Text() {}

    public static String sha256(String text) {
        return HexFormat.of().formatHex(digest("SHA-256", text.getBytes(StandardCharsets.UTF_8)));
    }

    public static byte[] digest(String algorithm, byte[] data) {
        try {
            return MessageDigest.getInstance(algorithm).digest(data);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static BigInteger md5Int(String text) {
        return new BigInteger(1, digest("MD5", text.getBytes(StandardCharsets.UTF_8)));
    }

    /** 문장 속 정수 (1,000 → 1000). 아침 브리핑의 수치 검증용. */
    public static Set<Long> integers(String text) {
        Set<Long> out = new LinkedHashSet<>();
        Matcher m = INT_NUM.matcher(text);
        while (m.find()) {
            String n = m.group().replace(",", "");
            if (n.length() <= 18) {
                out.add(Long.parseLong(n));
            }
        }
        return out;
    }

    /** 문장 속 숫자 (소수 포함, 0.30 → 0.3). RAG 보강 검증용. */
    public static Set<String> numbers(String text) {
        Set<String> out = new LinkedHashSet<>();
        Matcher m = DEC_NUM.matcher(text);
        while (m.find()) {
            String n = m.group().replace(",", "");
            if (n.contains(".")) {
                n = n.replaceAll("0+$", "").replaceAll("\\.$", "");
            }
            out.add(n);
        }
        return out;
    }

    /** 공백 단어 + 한글 2글자 묶음 (BM25와 오프라인 임베딩 공용). */
    public static List<String> tokenize(String text) {
        List<String> tokens = new ArrayList<>();
        Matcher m = TOKEN.matcher(text.toLowerCase(Locale.ROOT));
        while (m.find()) {
            String w = m.group();
            tokens.add(w);
            if (HANGUL.matcher(w).matches() && w.length() > 2) {   // 한글은 조사가 붙으므로 2글자 묶음도 추가
                for (int i = 0; i < w.length() - 1; i++) {
                    tokens.add(w.substring(i, i + 2));
                }
            }
        }
        return tokens;
    }

    /** 추론 모델의 사고 과정(<think>…</think>) 제거. */
    public static String stripThink(String text) {
        return THINK.matcher(text).replaceAll("").strip();
    }

    /** 화면 폭 기준으로 오른쪽을 공백으로 채운다 (한글은 두 칸). */
    public static String padDisplay(String text, int width) {
        int w = text.codePoints().map(c -> c > 0x3000 ? 2 : 1).sum();
        return text + " ".repeat(Math.max(1, width - w));
    }
}
