package com.techreview.briefing;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

/**
 * 데모용 가상 MES 데이터베이스(SQLite)를 만든다. (seed_mes.py와 같은 데이터)
 *
 * 가상의 중소기업(자동차 부품 사출·조립 2차 협력사)의 하루치 데이터:
 * 10/19 전일 생산·출하 계획과 실적, 10/20 금일 작업지시와 출하 계획, 07:00 기준 재고, 자재 입고 예정, 설비 이상 징후
 */
public final class SeedMes {
    static final String SCHEMA = """
            CREATE TABLE items (item_code TEXT PRIMARY KEY, item_name TEXT NOT NULL, process TEXT NOT NULL);
            CREATE TABLE work_orders (wo_id TEXT PRIMARY KEY, plan_date TEXT NOT NULL, line TEXT NOT NULL,
                item_code TEXT NOT NULL REFERENCES items, plan_qty INTEGER NOT NULL);
            CREATE TABLE production_results (result_date TEXT NOT NULL, line TEXT NOT NULL,
                item_code TEXT NOT NULL REFERENCES items, good_qty INTEGER NOT NULL, defect_qty INTEGER NOT NULL);
            CREATE TABLE shipment_plans (ship_date TEXT NOT NULL, customer TEXT NOT NULL,
                item_code TEXT NOT NULL REFERENCES items, qty INTEGER NOT NULL);
            CREATE TABLE shipments (ship_date TEXT NOT NULL, customer TEXT NOT NULL,
                item_code TEXT NOT NULL REFERENCES items, qty INTEGER NOT NULL);
            CREATE TABLE fg_inventory (as_of TEXT NOT NULL, item_code TEXT NOT NULL REFERENCES items, qty INTEGER NOT NULL);
            CREATE TABLE material_receipts (expected_date TEXT NOT NULL, material TEXT NOT NULL,
                supplier TEXT NOT NULL, status TEXT NOT NULL);
            CREATE TABLE equipment_signals (as_of TEXT NOT NULL, equipment TEXT NOT NULL, line TEXT NOT NULL,
                signal TEXT NOT NULL, trend TEXT NOT NULL);
            """;

    static final Object[][] ITEMS = {
            {"A-101", "도어 트림 브래킷", "사출"}, {"B-205", "센서 하우징 어셈블리", "조립"}, {"C-310", "커넥터 커버", "사출"}};
    static final Object[][] WORK_ORDERS = {
            {"WO-1019-01", "2026-10-19", "사출1라인", "A-101", 5000}, {"WO-1019-02", "2026-10-19", "조립2라인", "B-205", 3000},
            {"WO-1019-03", "2026-10-19", "사출2라인", "C-310", 4000}, {"WO-1020-01", "2026-10-20", "사출1라인", "A-101", 5000},
            {"WO-1020-02", "2026-10-20", "조립2라인", "B-205", 3000}, {"WO-1020-03", "2026-10-20", "사출2라인", "C-310", 4000}};
    static final Object[][] PRODUCTION_RESULTS = {
            {"2026-10-19", "사출1라인", "A-101", 4780, 95}, {"2026-10-19", "조립2라인", "B-205", 2900, 40},
            {"2026-10-19", "사출2라인", "C-310", 3600, 210}};
    static final Object[][] SHIPMENT_PLANS = {
            {"2026-10-19", "가온자동차", "A-101", 4500}, {"2026-10-19", "나래모빌리티", "B-205", 3000},
            {"2026-10-19", "가온자동차", "C-310", 2000}, {"2026-10-20", "가온자동차", "A-101", 4800},
            {"2026-10-20", "나래모빌리티", "B-205", 3500}, {"2026-10-20", "가온자동차", "C-310", 2000}};
    static final Object[][] SHIPMENTS = {
            {"2026-10-19", "가온자동차", "A-101", 4500}, {"2026-10-19", "나래모빌리티", "B-205", 3000},
            {"2026-10-19", "가온자동차", "C-310", 2000}};
    static final Object[][] FG_INVENTORY = {
            {"2026-10-20 07:00", "A-101", 1200}, {"2026-10-20 07:00", "B-205", 300}, {"2026-10-20 07:00", "C-310", 2500}};
    static final Object[][] MATERIAL_RECEIPTS = {
            {"2026-10-20", "자재 A (PP 수지)", "다온케미칼", "납기 회신 미수신"},
            {"2026-10-20", "자재 B (커넥터 핀)", "라온부품", "입고 확정"}};
    static final Object[][] EQUIPMENT_SIGNALS = {
            {"2026-10-20 06:50", "3호기 사출기", "사출2라인", "진동", "최근 3일 상승 추세"}};

    private SeedMes() {}

    public static Path seed(Path dbPath) throws Exception {
        Files.createDirectories(dbPath.toAbsolutePath().getParent());
        Files.deleteIfExists(dbPath);
        try (Connection c = DriverManager.getConnection("jdbc:sqlite:" + dbPath)) {
            c.setAutoCommit(false);
            try (Statement st = c.createStatement()) {
                for (String sql : SCHEMA.split(";")) {
                    if (!sql.isBlank()) {
                        st.executeUpdate(sql);
                    }
                }
            }
            insert(c, "items", ITEMS);
            insert(c, "work_orders", WORK_ORDERS);
            insert(c, "production_results", PRODUCTION_RESULTS);
            insert(c, "shipment_plans", SHIPMENT_PLANS);
            insert(c, "shipments", SHIPMENTS);
            insert(c, "fg_inventory", FG_INVENTORY);
            insert(c, "material_receipts", MATERIAL_RECEIPTS);
            insert(c, "equipment_signals", EQUIPMENT_SIGNALS);
            c.commit();
        }
        return dbPath;
    }

    private static void insert(Connection c, String table, Object[][] rows) throws SQLException {
        String marks = "?,".repeat(rows[0].length);
        try (PreparedStatement ps = c.prepareStatement("INSERT INTO " + table + " VALUES (" + marks.substring(0, marks.length() - 1) + ")")) {
            for (Object[] row : rows) {
                for (int i = 0; i < row.length; i++) {
                    ps.setObject(i + 1, row[i]);
                }
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.println("MES 샘플 DB 생성: " + seed(MesTools.DB_PATH));
    }
}
