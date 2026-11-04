"""Ollama 에이전트가 MCP 도구를 직접 골라 쓰는 데모 (tool calling).

흐름:  질문 → Ollama가 도구 선택 → MCP 서버에서 실행 → 결과를 다시 Ollama에 → … → 최종 답
- 도구 목록은 MCP 서버에서 받아 Ollama의 tools 형식으로 바꾼다 (도구를 코드에 다시 정의하지 않는다)
- 쓰기는 propose_* 도구뿐이라 AI가 아무리 판단해도 MES는 승인 전까지 바뀌지 않는다
- 도구 호출 횟수에 상한을 둔다

실행:
    ollama pull qwen3:8b                      # 도구 호출을 지원하는 모델
    python setup_demo.py
    python agent_ollama.py "오늘 출하 부족한 품목 있어? 있으면 조치를 제안해 줘"
    python approve.py list                    # AI가 올린 제안 확인 → 사람이 승인
"""

import asyncio
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from mcp.client.session import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:8b")
MAX_STEPS = 6
SERVER = StdioServerParameters(command=sys.executable, args=[str(Path(__file__).with_name("mes_mcp_server.py"))])
SYSTEM = (
    "너는 중소 제조공장의 AI 공장장이다. 도구로 MES 데이터와 지식을 조회해 한국어로 답한다.\n"
    "- 숫자는 도구 결과에 있는 값만 쓴다. 계산이 필요하면 계산 결과를 주는 도구를 쓴다\n"
    "- 작업지시 변경은 propose_* 도구로 '제안'만 할 수 있다. 실행은 사람이 승인해야 한다고 분명히 말한다\n"
    "- 답 끝에 출처(source)와 기준 시각(as_of)을 적는다"
)


def chat(messages: list[dict], tools: list[dict]) -> dict:
    body = {"model": MODEL, "messages": messages, "tools": tools, "stream": False, "think": False,
            "options": {"temperature": 0}}
    req = urllib.request.Request(OLLAMA_HOST + "/api/chat", data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))["message"]


def ollama_ready() -> bool:
    """MCP 서버를 띄우기 전에 Ollama 연결부터 확인한다 (연결 안에서 난 오류는 예외 그룹으로 감싸져 읽기 어렵다)."""
    try:
        with urllib.request.urlopen(OLLAMA_HOST + "/api/tags", timeout=5):
            return True
    except (urllib.error.URLError, OSError):
        return False


def to_ollama_tools(mcp_tools) -> list[dict]:
    """MCP 도구 정의를 Ollama tools 형식으로 바꾼다."""
    out = []
    for t in mcp_tools:
        schema = getattr(t, "inputSchema", None) or getattr(t, "input_schema", None) or {"type": "object", "properties": {}}
        out.append({"type": "function", "function": {"name": t.name, "description": t.description, "parameters": schema}})
    return out


async def run(question: str) -> str:
    async with stdio_client(SERVER) as (r, w), ClientSession(r, w) as s:
        await s.initialize()
        tools = to_ollama_tools((await s.list_tools()).tools)
        messages = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": question}]
        for step in range(1, MAX_STEPS + 1):
            msg = chat(messages, tools)
            calls = msg.get("tool_calls") or []
            if not calls:
                return re.sub(r"<think>.*?</think>", "", msg.get("content", ""), flags=re.S).strip()
            messages.append({"role": "assistant", "content": msg.get("content", ""), "tool_calls": calls})
            for c in calls:
                name, args = c["function"]["name"], c["function"].get("arguments") or {}
                if isinstance(args, str):
                    args = json.loads(args or "{}")
                print(f"  🔧 {step}. {name}({json.dumps(args, ensure_ascii=False)})")
                res = await s.call_tool(name, args)
                text = res.content[0].text if res.content else "{}"
                messages.append({"role": "tool", "tool_name": name, "content": text})
        return "도구 호출 횟수 상한에 도달해 멈췄습니다. 질문을 나눠서 다시 물어 주세요."


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    q = sys.argv[1] if len(sys.argv) > 1 else "오늘 출하 부족한 품목 있어? 있으면 조치를 제안해 줘"
    if not ollama_ready():
        sys.exit(f"❌ Ollama({OLLAMA_HOST})에 연결할 수 없습니다. Ollama를 실행하고 `ollama pull {MODEL}`을 하세요.\n"
                 "   LLM 없이 도구 흐름만 보려면: python demo_client.py")
    print(f"❓ {q}  (모델 {MODEL})")
    print("\n💬 " + asyncio.run(run(q)))
