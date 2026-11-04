package com.techreview.briefing;

import com.techreview.common.Json;
import com.techreview.common.Ollama;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.sqlite.SQLiteConfig;

/**
 * MES 조회 도구 (읽기 전용). mes_tools.py와 같은 SQL.
 *
 * AI 공장장이 쓰는 '숫자의 출처'. 모든 집계는 여기서 SQL로 계산하고, LLM은 이 결과를 해석·요약만 한다.
 * 실제 환경에서는 이 메서드들을 MES 조회 API나 MCP 서버로 노출하면 된다.
 */
public final class MesTools {
    public static final Path DB_PATH = Path.of(Ollama.env("MES_DB", "data/mes.db"));

    private MesTools() {}

    static List<Map<String, Object>> query(String sql, Object... params) {
        SQLiteConfig config = new SQLiteConfig();
        config.setReadOnly(true);   // 읽기 전용으로 연결해서 AI가 MES 데이터를 바꿀 수 없게 한다
        try (Connection c = config.createConnection("jdbc:sqlite:" + DB_PATH);
             PreparedStatement ps = c.prepareStatement(sql)) {
            for (int i = 0; i < params.length; i++) {
                ps.setObject(i + 1, params[i]);
            }
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData md = rs.getMetaData();
                List<Map<String, Object>> rows = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= md.getColumnCount(); i++) {
                        Object v = rs.getObject(i);
                        row.put(md.getColumnLabel(i), v instanceof Integer n ? Long.valueOf(n) : v);
                    }
                    rows.add(row);
                }
                return rows;
            }
        } catch (SQLException e) {
            throw new IllegalStateException("MES 조회 실패: " + e.getMessage(), e);
        }
    }

    private static long one(String sql, Object... params) {
        return ((Number) query(sql, params).get(0).get("q")).longValue();
    }

    private static String text(String sql, Object... params) {
        Object v = query(sql, params).get(0).values().iterator().next();
        return v == null ? "" : v.toString();
    }

    /** 해당 일자의 생산 계획 대비 실적 (작업지시 + 작업실적). */
    public static Map<String, Object> getProductionSummary(String date) {
        long plan = one("SELECT COALESCE(SUM(plan_qty), 0) AS q FROM work_orders WHERE plan_date = ?", date);
        long actual = one("SELECT COALESCE(SUM(good_qty), 0) AS q FROM production_results WHERE result_date = ?", date);
        return Json.obj("date", date, "plan", plan, "actual", actual);
    }

    /** 해당 일자의 출하 계획 대비 실적 (출하 계획 + 출하 실적). */
    public static Map<String, Object> getShipmentSummary(String date) {
        long plan = one("SELECT COALESCE(SUM(qty), 0) AS q FROM shipment_plans WHERE ship_date = ?", date);
        long actual = one("SELECT COALESCE(SUM(qty), 0) AS q FROM shipments WHERE ship_date = ?", date);
        return Json.obj("date", date, "plan", plan, "actual", actual);
    }

    /** 품목별 금일 생산 계획, 출하 예정, 완제품 재고 (작업지시 + 출하 계획 + 재고). */
    public static List<Map<String, Object>> getTodayPlanByItem(String date) {
        return query("""
                SELECT i.item_code, i.item_name, i.process,
                       COALESCE((SELECT SUM(plan_qty) FROM work_orders w
                                 WHERE w.item_code = i.item_code AND w.plan_date = ?), 0) AS production_plan,
                       COALESCE((SELECT GROUP_CONCAT(DISTINCT line) FROM work_orders w
                                 WHERE w.item_code = i.item_code AND w.plan_date = ?), '') AS line,
                       COALESCE((SELECT SUM(qty) FROM shipment_plans s
                                 WHERE s.item_code = i.item_code AND s.ship_date = ?), 0) AS shipment_plan,
                       COALESCE((SELECT qty FROM fg_inventory f
                                 WHERE f.item_code = i.item_code ORDER BY as_of DESC LIMIT 1), 0) AS fg_inventory
                FROM items i
                ORDER BY i.item_code
                """, date, date, date);
    }

    /** 완제품 재고 스냅숏의 기준 시각. */
    public static String getInventoryAsOf() {
        return text("SELECT MAX(as_of) AS t FROM fg_inventory");
    }

    /** 금일 입고 예정 중 확정되지 않은 자재. */
    public static List<Map<String, Object>> getMaterialRisks(String date) {
        return query("SELECT material, supplier, status FROM material_receipts WHERE expected_date = ? AND status != '입고 확정'", date);
    }

    /** 이상 감지 모델이 기록한 설비 이상 징후. */
    public static List<Map<String, Object>> getEquipmentSignals() {
        return query("SELECT equipment, line, signal, trend, as_of FROM equipment_signals");
    }

    /** 품목 하나의 전일 실적·출하, 금일 계획·출하 예정, 재고를 모아 조회 (원인 분석용). 없으면 null. */
    public static Map<String, Object> getItemDetail(String itemCode, String today, String yesterday) {
        List<Map<String, Object>> item = query("SELECT item_code, item_name, process FROM items WHERE item_code = ?", itemCode);
        if (item.isEmpty()) {
            return null;
        }
        Map<String, Object> d = new LinkedHashMap<>(item.get(0));
        d.put("line", text("SELECT COALESCE(GROUP_CONCAT(DISTINCT line), '') AS l FROM work_orders WHERE item_code = ? AND plan_date = ?", itemCode, today));
        d.put("yesterday", yesterday);
        d.put("today", today);
        d.put("plan_yesterday", one("SELECT COALESCE(SUM(plan_qty), 0) AS q FROM work_orders WHERE item_code = ? AND plan_date = ?", itemCode, yesterday));
        d.put("produced_yesterday", one("SELECT COALESCE(SUM(good_qty), 0) AS q FROM production_results WHERE item_code = ? AND result_date = ?", itemCode, yesterday));
        d.put("defects_yesterday", one("SELECT COALESCE(SUM(defect_qty), 0) AS q FROM production_results WHERE item_code = ? AND result_date = ?", itemCode, yesterday));
        d.put("shipped_yesterday", one("SELECT COALESCE(SUM(qty), 0) AS q FROM shipments WHERE item_code = ? AND ship_date = ?", itemCode, yesterday));
        d.put("plan_today", one("SELECT COALESCE(SUM(plan_qty), 0) AS q FROM work_orders WHERE item_code = ? AND plan_date = ?", itemCode, today));
        d.put("ship_plan_today", one("SELECT COALESCE(SUM(qty), 0) AS q FROM shipment_plans WHERE item_code = ? AND ship_date = ?", itemCode, today));
        d.put("customers_today", text("SELECT COALESCE(GROUP_CONCAT(DISTINCT customer), '') AS c FROM shipment_plans WHERE item_code = ? AND ship_date = ?", itemCode, today));
        d.put("fg_inventory", one("SELECT COALESCE((SELECT qty FROM fg_inventory WHERE item_code = ? ORDER BY as_of DESC LIMIT 1), 0) AS q", itemCode));
        return d;
    }

    /** 등록된 품목 코드 목록. */
    public static List<String> listItemCodes() {
        return query("SELECT item_code FROM items ORDER BY item_code").stream().map(r -> (String) r.get("item_code")).toList();
    }
}
