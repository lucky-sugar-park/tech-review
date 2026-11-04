package com.techreview;

import com.techreview.briefing.Ask;
import com.techreview.briefing.Briefing;
import com.techreview.briefing.SeedMes;
import com.techreview.common.Cli;
import com.techreview.mcp.McpApprove;
import com.techreview.mcp.McpDemo;
import com.techreview.mcp.MesApi;
import com.techreview.mcp.MesMcpServer;
import com.techreview.rag.Converter;
import com.techreview.rag.DemoScenario;
import com.techreview.rag.Enrich;
import com.techreview.rag.Evaluate;
import com.techreview.rag.Indexer;
import com.techreview.rag.Search;

import java.util.Arrays;

/**
 * 데모 실행 진입점: java -jar demo.jar <명령> [옵션]
 *
 * 아침 브리핑:  seed · briefing [--no-llm] · ask "질문" [--no-llm]
 * 지식 도우미:  convert · enrich [--offline] · index [--offline] · search "질문" · evaluate [--offline] · scenario [--offline]
 * MCP 서버:    mcp-setup · mcp-server · mcp-demo · mcp-approve list|show|approve|reject|audit
 */
public final class Main {
    private Main() {}

    public static void main(String[] args) throws Exception {
        Cli.utf8Stdout();
        if (args.length == 0) {
            usage();
            return;
        }
        String[] rest = Arrays.copyOfRange(args, 1, args.length);
        try {
            switch (args[0]) {
                case "seed" -> SeedMes.main(rest);
                case "briefing" -> Briefing.main(rest);
                case "ask" -> Ask.main(rest);
                case "convert" -> Converter.main(rest);
                case "enrich" -> Enrich.main(rest);
                case "index" -> Indexer.main(rest);
                case "search" -> Search.main(rest);
                case "evaluate" -> Evaluate.main(rest);
                case "scenario" -> DemoScenario.main(rest);
                case "mcp-setup" -> {
                    MesApi.setup();
                    System.out.println("MCP 데모용 MES DB 생성: " + MesApi.DB_PATH + " · 승인 대기열 초기화");
                }
                case "mcp-server" -> MesMcpServer.main(rest);
                case "mcp-demo" -> McpDemo.main(rest);
                case "mcp-approve" -> McpApprove.main(rest);
                default -> usage();
            }
        } catch (Cli.Exit e) {
            System.out.println(e.getMessage());
            System.exit(1);
        }
    }

    static void usage() {
        System.out.println("""
                사용법: java -jar build/libs/demo.jar <명령> [옵션]

                [아침 브리핑]
                  seed                         가상 MES DB 생성 (data/mes.db)
                  briefing [--no-llm]          아침 브리핑
                  ask "B-205는 왜 부족해?" [--no-llm]

                [지식 도우미 (RAG 인덱싱)]  원천 폴더: ../rag-indexer (RAG_BASE로 변경)
                  convert [--force]            raw/ 원본 → sources/converted/*.md
                  enrich [--offline] [--model qwen3:14b] [--show]
                  index [--offline] [--dry-run] [--contextualize] [--watch 10]
                  search "질문" [-k 3] [--doc-type 작업표준서] [--equipment 3호기] [--answer]
                  evaluate [--offline] [--detail]
                  scenario [--offline] [--pause]

                [MES 도구 MCP 서버]
                  mcp-setup                    MCP 데모용 MES DB 생성 (data/mcp-mes.db), 승인 대기열 초기화
                  mcp-server                   MCP 서버 실행 (stdio, 보통은 MCP 클라이언트가 띄운다)
                  mcp-demo                     LLM 없이 조회 → 제안 → 사람 승인 → MES 반영 흐름 보기
                  mcp-approve list|show ID|approve ID --by 이름|reject ID --by 이름 --note 사유|audit
                """);
    }
}
