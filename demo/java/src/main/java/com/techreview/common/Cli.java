package com.techreview.common;

import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 아주 단순한 명령줄 인자 파서: 위치 인자, --flag, --option 값, -k 값. */
public final class Cli {
    public final List<String> positional = new ArrayList<>();
    private final Set<String> flags = new HashSet<>();
    private final Map<String, String> options = new HashMap<>();

    public Cli(String[] args, Set<String> valueOptions) {
        for (int i = 0; i < args.length; i++) {
            String a = args[i];
            if (a.startsWith("-") && valueOptions.contains(a) && i + 1 < args.length) {
                options.put(a, args[++i]);
            } else if (a.startsWith("--") && a.contains("=")) {
                options.put(a.substring(0, a.indexOf('=')), a.substring(a.indexOf('=') + 1));
            } else if (a.startsWith("-")) {
                flags.add(a);
            } else {
                positional.add(a);
            }
        }
    }

    public boolean flag(String name) {
        return flags.contains(name);
    }

    public String opt(String name, String def) {
        return options.getOrDefault(name, def);
    }

    public int intOpt(String name, int def) {
        return options.containsKey(name) ? Integer.parseInt(options.get(name)) : def;
    }

    /** Windows 콘솔에서도 한글·이모지가 깨지지 않도록 표준 출력을 UTF-8로 고정한다. */
    public static void utf8Stdout() {
        System.setOut(new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8));
        System.setErr(new PrintStream(new FileOutputStream(FileDescriptor.err), true, StandardCharsets.UTF_8));
    }

    /** 실행을 멈추고 메시지를 출력한다 (파이썬의 SystemExit에 해당). */
    public static final class Exit extends RuntimeException {
        public Exit(String message) {
            super(message);
        }
    }
}
