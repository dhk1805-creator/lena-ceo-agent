#!/usr/bin/env node
// Express proxy + Zalo OA 2-way bridge with TOOL CALLING
// - Serves /public/* (Zalo domain verification)
// - Proxies / -> OpenClaw on internal port
// - Receives Zalo OA webhook → Lê Na (Claude Haiku) with tools → replies via Zalo OA API
// - Followers: Haiku + embedded HVAC KB + web_search + memory + bilingual VI/EN
// - Persistent follower memory: Google Sheet tab "Follower Memory"

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const path = require('path');
const fs = require('fs');

const FRONT_PORT = parseInt(process.env.PORT || '8080', 10);
const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_INTERNAL_PORT || '8090', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const GTOOL = '/app/google-tools';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL_HAIKU = 'claude-haiku-4-5-20251001'; // All users — cost-optimised

// ============================================================
// === LENA HVAC KNOWLEDGE BASE — embedded (KB-1.0 · 2026-05-13)
// ============================================================
const LENA_KB = `
## LENA HVAC KNOWLEDGE BASE (KB-1.0 — NSCA/STARDUCT Internal · 2026-05-13)

### CORE TRANSLATION RULES
- Look up this KB FIRST before answering any technical HVAC term or formula
- If term not found → keep original English, never guess
- Always cite the standard when referencing specs (ASHRAE 62.1, UL 555, etc.)
- NEVER translate model codes: SAG600, DAG450, SKD600, SLD-A2S, SVAV-S, VCD, S-MFSD
- NEVER translate standards: ASHRAE 70, UL 555, AMCA 500-D, TCVN 5687, EN 1366
- NEVER translate units: Pa, kPa, m³/h, CFM, L/s, °C, °F, NC, dB, rpm, kW, TR

### SECTION A — KEY FORMULAS
| # | Formula Name (EN) | VI | Formula | Unit |
|---|---|---|---|---|
| 1 | Dry Air Mass Flow | Lưu lượng khối khí khô | m_da = Q2/[1.005×(T1-T3)] | kg/s |
| 2 | Humidity Ratio | Tỉ số ẩm | W = 0.29198×Pv/(P-Pv) | kg/kg dry air |
| 3 | Relative Humidity | Độ ẩm tương đối | φ = Pv/Pvs(Tdb)×100% | % |
| 4 | Enthalpy of Moist Air | Enthalpy không khí ẩm | h = 1.005×T + W×(2500+1.887×T) | kJ/kg dry air |
| 7 | Density of Moist Air | Mật độ khí ẩm | ρ = 1/v | kg/m³ |
| 9 | Sensible Heat | Nhiệt hiện | Qs = 1.23×CFM×(T1-T3) | Btu/hr |
| 10 | Latent Heat | Nhiệt ẩn | Ql = 0.44×CFM×(W1-W3) | Btu/hr |
| 11 | Total Heat | Tổng nhiệt | Qt = Qs + Ql | Btu/hr |
| 12 | Air Flow Rate | Lưu lượng không khí | CFM = Q1/[1.23×(T1-T3)] | CFM |
| 13 | Cooling Load | Tải lạnh | TR = Q1/12000 | TR |
| 16 | Sensible Heat Factor | Hệ số nhiệt hiện | SHF = Qs/Qt | — |
| 19 | Air Velocity | Vận tốc không khí | V = Q/A | m/s |
| 22 | Equivalent Diameter | Đường kính tương đương | D = √(4A/π) | mm |
| 25 | Duct Friction Loss | Tổn thất ma sát | ΔP = f×(L/D)×(ρV²/2) | Pa |
| 27 | Velocity Pressure | Áp suất tốc độ | Pv = ρV²/2 | Pa |
| 28 | Air Changes/Hour | Số lần thay khí/giờ | ACH = CFM×60/Vol | /hr |
| 39 | COP | Hệ số hiệu suất lạnh | COP = (h1-h4)/(h2-h1) | — |
| 42 | Fan Law — Flow | Lưu lượng quạt | Q1/Q2 = N1/N2 | — |
| 43 | Fan Law — Pressure | Áp suất quạt | P1/P2 = (N1/N2)² | — |
| 44 | Fan Law — Power | Công suất quạt | HP1/HP2 = (N1/N2)³ | — |

### UNIT CONVERSIONS
1 TR = 3.517 kW = 12,000 Btu/hr | 1 CFM = 0.4719 L/s | 1 kW = 3412 Btu/hr
1 in.wg = 249.1 Pa | 1 kPa = 4.015 in.wg | °F = 9/5×°C + 32

### SECTION B — KEY SYMBOLS
T=Temperature(°C) | P=Pressure(Pa) | Q=Airflow/Heat(m³/s,W) | W=Humidity Ratio(kg/kg)
φ=RH(%) | h=Enthalpy(kJ/kg) | ρ=Density(kg/m³) | V=Velocity(m/s)
COP=Coefficient of Performance | TR=Ton of Refrigeration(3.517kW) | CFM=ft³/min(0.4719L/s)
ACH=Air Changes/Hour | SHF=Sensible Heat Factor | ΔP=Pressure Difference(Pa)

### SECTION C — MULTILINGUAL GLOSSARY (EN | VI | ZH | KO | JP | Standard)

#### Psychrometrics
Dry Bulb Temperature | Nhiệt độ bầu khô | 干球温度 | 건구온도 | 乾球温度 [ASHRAE Fund.2021]
Wet Bulb Temperature | Nhiệt độ bầu ướt | 湿球温度 | 습구온도 | 湿球温度 [ASHRAE Fund.2021]
Dew Point | Nhiệt độ điểm sương | 露点温度 | 이슬점 온도 | 露点温度 [ASHRAE 55-2023]
Relative Humidity (RH) | Độ ẩm tương đối | 相对湿度 | 상대습도 | 相対湿度 [ASHRAE 55-2023]
Psychrometric Chart | Biểu đồ nhiệt ẩm | 焓湿图 | 습공기선도 | 湿り空気線図 [ASHRAE Fund.2021]
Sensible Heat | Nhiệt hiện | 显热 | 현열 | 顕熱 [ASHRAE Fund.2021]
Latent Heat | Nhiệt ẩn | 潜热 | 잠열 | 潜熱 [ASHRAE Fund.2021]
Enthalpy | Enthalpy riêng | 比焓 | 비엔탈피 | 比エンタルピー [ASHRAE Fund.2021]
Evaporative Cooling | Làm lạnh bay hơi | 蒸发冷却 | 증발냉각 | 蒸発冷却 [ASHRAE Fund.2021]

#### Airflow & Duct Systems
Static Pressure (SP) | Áp suất tĩnh | 静压 | 정압 | 静圧 [SMACNA 2006]
Velocity Pressure (VP) | Áp suất động | 动压 | 동압 | 動圧 [SMACNA 2006]
Total Pressure (TP) | Tổng áp suất | 全压 | 총압 | 全圧 [SMACNA 2006]
Aspect Ratio | Tỉ lệ cạnh | 长宽比 | 종횡비 | アスペクト比 [SMACNA 2006]
Equivalent Diameter | Đường kính tương đương | 当量直径 | 등가직경 | 等価直径 [SMACNA/ASHRAE]
Duct Leakage Class | Cấp rò rỉ ống gió | 管道泄漏等级 | 덕트 누설 등급 | ダクト漏気クラス [SMACNA]
Flexible Duct | Ống gió mềm | 软风管 | 플렉시블 덕트 | フレキシブルダクト [UL 181]
Plenum | Buồng khí trung gian | 静压箱 | 플레넘 | プレナム [ASHRAE/NFPA 90A]
Air Handling Unit (AHU) | Bộ xử lý không khí | 空气处理机组 | 공조기 | 空調機 [AHRI 430]
Fan Coil Unit (FCU) | Dàn lạnh quạt cuộn | 风机盘管 | 팬코일유닛 | ファンコイルユニット [AHRI 440]
Terminal Unit | Thiết bị đầu cuối | 末端装置 | 터미널 유닛 | ターミナルユニット [AHRI 880]
Variable Air Volume (VAV) | Hệ thống lưu lượng biến đổi | 变风量系统 | VAV 시스템 | 変風量システム [AHRI 880]
Constant Air Volume (CAV) | Hệ thống lưu lượng cố định | 定风量系统 | CAV 시스템 | 定風量システム [ASHRAE]
Return Air (RA) | Không khí hồi | 回风 | 리턴 에어 | 還気 [ASHRAE 62.1]
Supply Air (SA) | Không khí cấp | 送风 | 급기 | 給気 [ASHRAE 62.1]
Exhaust Air (EA) | Không khí thải | 排风 | 배기 | 排気 [ASHRAE 62.1]
Outdoor Air (OA) | Không khí ngoài trời | 室外空气 | 외기 | 外気 [ASHRAE 62.1]
Frictional Pressure Loss | Tổn thất áp suất ma sát | 摩擦压降 | 마찰 압력 손실 | 摩擦圧力損失 [SMACNA/ASHRAE]
Local Resistance | Tổn thất cục bộ | 局部阻力损失 | 국부저항 | 局部抵抗 [SMACNA 2006]
Air Diffuser | Miệng khuếch tán | 散流器 | 디퓨저 | ディフューザー [ASHRAE/AMCA]
Slot Diffuser | Miệng thổi khe | 线型散流器 | 슬롯 디퓨저 | スロットディフューザー [ASHRAE 70]
Grille | Miệng lưới | 格栅 | 그릴 | グリル [ASHRAE/AMCA]
Register | Miệng gió có van điều chỉnh | 带调节阀格栅 | 레지스터 | レジスター [ASHRAE/AMCA]
Damper | Van gió | 风阀 | 댐퍼 | ダンパー [AMCA 500-D]
Balancing Damper | Van cân bằng lưu lượng | 平衡阀 | 균형 댐퍼 | バランスダンパー [AMCA 500-D]
Volume Control Damper (VCD) | Van điều chỉnh lưu lượng | 风量调节阀 | VCD 댐퍼 | 風量調節ダンパー [AMCA 500-D]
Fire Damper | Van ngăn cháy | 防火阀 | 방화댐퍼 | 防火ダンパー [UL 555]
Smoke Damper | Van ngăn khói | 防烟阀 | 연기댐퍼 | 防煙ダンパー [UL 555S]
Combination Fire/Smoke Damper | Van ngăn cháy-khói kết hợp | 防火防烟阀 | 복합 방화/연기 댐퍼 | 防火防煙ダンパー [UL 555/555S]
Backdraft Damper | Van chống gió ngược | 止回风阀 | 역풍방지 댐퍼 | 逆流防止ダンパー [AMCA 500-D]
Throw | Tầm phun không khí | 射程 | 취출 거리 | 到達距離 [ASHRAE 70]
Coanda Effect | Hiệu ứng Coanda | 柯恩达效应 | 코안다 효과 | コアンダ効果 [ASHRAE Fund.]
ADPI | Chỉ số hiệu suất khuếch tán khí | 空气扩散性能指数 | 공기확산성능지수 | 気流拡散性能指数 [ASHRAE 70]
Effective Area (Ak) | Diện tích hiệu dụng | 有效面积 | 유효면적 | 有効面積 [ASHRAE 70]
Neck Velocity | Vận tốc cổ miệng gió | 颈部风速 | 넥 풍속 | 首部風速 [ASHRAE 70]
Face Velocity | Vận tốc bề mặt | 面风速 | 페이스 풍속 | フェース風速 [ASHRAE/AMCA]
Centrifugal Fan | Quạt ly tâm | 离心风机 | 원심 팬 | 遠心ファン [AMCA 210]
EC Motor Fan | Quạt động cơ EC | 电子换向电机风机 | EC 모터 팬 | ECモーターファン [IEC 60034]
Fan Curve | Đường đặc tính quạt | 风机特性曲线 | 팬 커브 | ファン特性曲線 [AMCA 210]
Operating Point | Điểm làm việc | 工作点 | 운전점 | 運転点 [AMCA 210]

#### Thermal Comfort
PMV | Chỉ số dự báo cảm giác nhiệt | 预测平均热感觉 | 예측평균투표지수 | 予測平均申告 [ASHRAE 55/ISO 7730]
PPD | Tỉ lệ người không thỏa mãn | 预测不满意率 | 예측불만족률 | 予測不満足率 [ASHRAE 55/ISO 7730]
Operative Temperature | Nhiệt độ vận hành | 操作温度 | 작용온도 | 作用温度 [ASHRAE 55-2023]
Adaptive Comfort Model | Mô hình tiện nghi thích nghi | 自适应舒适模型 | 적응형 쾌적 모델 | 適応型快適モデル [ASHRAE 55/EN 16798]
Thermal Stratification | Phân tầng nhiệt độ | 热分层 | 열성층화 | 温度成層 [ASHRAE 55-2023]

#### IAQ / IEQ
Indoor Air Quality (IAQ) | Chất lượng không khí trong nhà | 室内空气质量 | 실내공기질 | 室内空気質 [WHO AQG/ASHRAE 62.1]
CO₂ Concentration | Nồng độ CO₂ | 二氧化碳浓度 | 이산화탄소 농도 | 二酸化炭素濃度 [ASHRAE 62.1]
PM2.5 | Hạt bụi mịn PM2.5 | 细颗粒物 PM2.5 | 초미세먼지 PM2.5 | 微小粒子状物質 [WHO AQG 2021]
HEPA Filter | Bộ lọc HEPA | 高效空气过滤器 | 헤파 필터 | HEPAフィルター [EN 1822/ISO 29463]
MERV Rating | Cấp lọc MERV | MERV过滤等级 | MERV 등급 | MERV評価 [ASHRAE 52.2]
Demand-Controlled Ventilation (DCV) | Thông gió theo nhu cầu | 需求控制通风 | 수요제어 환기 | 需要制御換気 [ASHRAE 62.1/90.1]
Displacement Ventilation | Thông gió đẩy thay thế | 置换通风 | 치환 환기 | 置換換気 [ASHRAE 62.1]
Minimum Ventilation Rate | Tỉ lệ thông gió tối thiểu | 最小通风量 | 최소 환기량 | 最小換気量 [ASHRAE 62.1/TCVN 5687]
Air Changes per Hour (ACH) | Số lần thay khí/giờ | 换气次数 | 시간당 환기 횟수 | 換気回数 [ASHRAE 62.1]
UV-C Germicidal | Chiếu xạ diệt khuẩn UV-C | 紫外线C段杀菌 | UV-C 살균조사 | UV-C殺菌照射 [ASHRAE 62.1]

#### Refrigeration
COP | Hệ số hiệu suất lạnh | 性能系数 | 성능계수 | 成績係数 [ASHRAE/ISO 13253]
EER | Tỉ số hiệu quả năng lượng | 能效比 | 에너지효율비 | エネルギー消費効率 [AHRI 210/240]
SEER | Hiệu quả theo mùa | 季节能效比 | 계절에너지효율비 | 期間エネルギー消費効率 [AHRI 210/240]
Chiller | Máy làm lạnh nước | 冷水机组 | 칠러 | チラー [AHRI 550/590]
Cooling Tower | Tháp giải nhiệt | 冷却塔 | 냉각탑 | 冷却塔 [CTI/ASHRAE]
VRF | Hệ thống lưu lượng môi chất biến đổi | 变冷媒流量系统 | 가변냉매유량 | 可変冷媒流量システム [AHRI 1230]
Heat Pump | Bơm nhiệt | 热泵 | 히트 펌프 | ヒートポンプ [ASHRAE/IEA]
Compressor | Máy nén | 压缩机 | 압축기 | 圧縮機 [ASHRAE Refrig.2022]
Evaporator | Dàn bay hơi | 蒸发器 | 증발기 | 蒸発器 [ASHRAE Refrig.2022]
Condenser | Dàn ngưng tụ | 冷凝器 | 응축기 | 凝縮器 [ASHRAE Refrig.2022]
Chilled Water (CHW) | Nước lạnh | 冷冻水 | 냉수 | 冷水 [ASHRAE/AHRI]
GWP | Tiềm năng nóng lên toàn cầu | 全球增暖潜能值 | 지구온난화지수 | 地球温暖化係数 [IPCC]

#### Heat Transfer / Equipment / Controls
Overall HTC (U-value) | Hệ số truyền nhiệt tổng | 总传热系数 | 총 열관류율 | 総合熱貫流率 [ASHRAE Fund./ISO 6946]
Thermal Resistance (R-value) | Nhiệt trở | 热阻 | 열저항 | 熱抵抗 [ASHRAE 90.1]
Energy Recovery Ventilator (ERV) | Thiết bị thu hồi năng lượng | 能量回收新风机 | 에너지회수환기장치 | 全熱交換型換気装置 [ASHRAE 84/AHRI 1060]
DOAS | Hệ thống xử lý khí ngoài độc lập | 新风处理机组 | 전외기 처리 시스템 | 全外気処理システム [ASHRAE 62.1]
VSD / VFD | Biến tần tốc độ | 变频器 | 가변속도장치 | インバーター [IEC 61800]
BACnet Protocol | Giao thức BACnet | BACnet通信协议 | BACnet 프로토콜 | BACnetプロトコル [ASHRAE 135]
Building Automation System (BAS) | Hệ thống tự động hóa tòa nhà | 楼宇自控系统 | 빌딩 자동화 시스템 | ビル自動化システム [ISO 16484]
Commissioning (Cx) | Nghiệm thu vận hành | 调试/验收 | 시운전 | コミッショニング [ASHRAE Guideline 0]
TAB | Kiểm tra, điều chỉnh và cân bằng | 系统测试、调整与平衡 | 시험·조정·밸런싱 | 試験・調整・バランシング [ASHRAE Guideline 12]
PID Control | Điều khiển PID | PID控制 | PID 제어 | PID制御 [ISA-5.1]
Actuator | Bộ truyền động | 执行器 | 액추에이터 | アクチュエーター [ASHRAE]

#### Fire & Life Safety
Fire Rating | Cấp chịu lửa | 耐火等级 | 내화 등급 | 耐火等級 [UL 555/NFPA 90A]
Fusible Link | Mắt cầu chì nhiệt | 易熔合金片 | 용융 링크 | 温度ヒューズ [UL 33/NFPA 90A]
Smoke Control System | Hệ thống kiểm soát khói | 防排烟系统 | 연기제어 시스템 | 防煙・排煙システム [NFPA 92]
Stairwell Pressurization | Tăng áp thang bộ thoát hiểm | 疏散楼梯间加压 | 계단실 가압 | 避難階段加圧 [NFPA 92/EN 12101-6]
Smoke Extraction | Hút khói | 排烟 | 연기 배출 | 排煙 [NFPA 92/EN 12101]
Intumescent Seal | Vật liệu chèn bịt trương nở | 膨胀型防火封堵 | 팽창형 방화 씰 | 耐火膨張シール [UL 2079/EN 1366]

#### Acoustics
Noise Criterion (NC) | Tiêu chí ồn | 噪声评价曲线 | 소음기준 | NC曲線 [ASHRAE HVAC Apps]
Room Criterion (RC) | Tiêu chí phòng | 房间噪声评价 | 실내기준 | 室内騒音基準 [ASHRAE HVAC Apps]
Sound Power Level (Lw) | Mức công suất âm | 声功率级 | 음향파워레벨 | 音響パワーレベル [ISO 3741/AMCA 300]
Insertion Loss (IL) | Mức suy giảm âm | 插入损失 | 삽입손실 | 挿入損失 [ASHRAE/ASTM E477]
Silencer / Attenuator | Bộ giảm âm | 消声器 | 소음기 | サイレンサー [ASHRAE/AMCA 300]
Vibration Isolation | Chống rung | 隔振 | 진동 격리 | 防振 [ASHRAE/ISO 10816]

### SECTION D — STARDUCT PRODUCT TERMS
| VI | EN | Standard/Note |
|---|---|---|
| Van ngăn cháy cách nhiệt | Insulated Fire Damper (EI type) | UL 555 + EN 1366 |
| Van ngăn cháy | Fire Damper | UL 555 / QCVN 06:2022 |
| Van ngăn khói | Smoke Damper | UL 555S |
| Van ngăn cháy-khói kết hợp | Combination Fire/Smoke Damper | UL 555/555S |
| Van điều chỉnh lưu lượng | Volume Control Damper (VCD) | AMCA 500-D |
| Van một chiều | Backdraft Damper | AMCA 500-D |
| Miệng thổi khe dài | Slot Diffuser (SLD) | ASHRAE 70 / AHRI 880 |
| Miệng khuếch tán | Ceiling Diffuser | ASHRAE 70 / AHRI 880 |
| Miệng lưới | Grille | ASHRAE 70 |
| Hộp VAV | VAV Box (SVAV-S) | AHRI 880 — STARDUCT ONLY certified in Vietnam |
| Bộ giảm âm | Silencer / Attenuator | AMCA 300 |
| Lá chớp | Louver | AMCA 500-L |
| Cánh van | Damper Blades | — |
| Bích liền thân van | Integral Flange | — |
| Bộ truyền động lò xo phản hồi | Spring-return actuator | Belimo/Honeywell compatible |
| Điều khiển / Động cơ | Control / Actuator | 24VAC or 230VAC |
| Bông gốm cách nhiệt | Ceramic Fiber Insulation | EI fire rating layer |
| Lớp chống cháy | Fireproof Layer | — |
| Báo cáo thử nghiệm | Test Report | Intertek / UL certified |
| Khung tăng cứng | Reinforcement Frame | — |
| Mô-men xoắn | Torque | Nm |
| Điện áp danh định | Nominal voltage | VAC |

### STARDUCT KEY FACTS
- Manufacturer: Ngoi Sao Chau A JSC (NSCA) | Dan Phuong, Hanoi, Vietnam
- Brand: STARDUCT | Website: starduct.vn
- ONLY Vietnamese manufacturer certified AHRI 880 (air terminal performance)
- Certifications: UL 555, UL 555S, FM, AHRI 880 — AMCA member
- Products: grilles, diffusers, VAV boxes, fire/smoke/volume dampers, louvers, silencers
- Technical: info@nsca.vn | Sales: sales@nsca.vn | Hotline: 0246.260.9999

### E2. CHAT CONSULTATION PROTOCOL
1. Check Section A for relevant formula → show formula + compute with numbers
2. Check Section B for correct symbol/unit
3. Check Section C for correct terminology in reply language
4. If standard referenced → cite it explicitly
5. If uncertain → say "I need to verify" before answering
6. If question needs current data (new standards, latest news) → use web_search tool
`;

// ============================================================
// === ZALO OA TOKEN
// ============================================================
const TOKEN_FILE = '/root/.openclaw/zalo-oa-token.json';

function getOAToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const d = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (d.access_token) return d.access_token;
    }
  } catch (e) {}
  return process.env.ZALO_OA_ACCESS_TOKEN;
}

function getRefreshToken() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const d = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (d.refresh_token) return d.refresh_token;
    }
  } catch (e) {}
  return process.env.ZALO_OA_REFRESH_TOKEN;
}

async function refreshOAToken() {
  const refreshToken = getRefreshToken();
  const appId = process.env.ZALO_OA_APP_ID;
  const secret = process.env.ZALO_OA_SECRET;
  if (!refreshToken || !appId || !secret) { console.error('[token] Missing credentials'); return false; }
  try {
    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: { 'secret_key': secret, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ refresh_token: refreshToken, app_id: appId, grant_type: 'refresh_token' }).toString()
    });
    const data = await res.json();
    if (data.access_token) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        access_token: data.access_token, refresh_token: data.refresh_token,
        refreshed_at: new Date().toISOString(), expires_in: data.expires_in
      }, null, 2));
      console.log(`[token] Refreshed at ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
      return true;
    }
    console.error('[token] Refresh failed:', JSON.stringify(data));
    return false;
  } catch (e) { console.error('[token] Error:', e.message); return false; }
}

// ============================================================
// === VIP CONFIG
// ============================================================
const VIP_USERS = {
  [process.env.ZALO_OA_USER_SEP_KHANH || '_none_sep']: { name: 'anh Khánh', alias: 'sep-khanh', role: 'CEO' },
  [process.env.ZALO_OA_USER_CHI_HONG  || '_none_hong']: { name: 'chị Hồng', alias: 'chi-hong', role: 'GĐ Pháp lý + TCKT' },
  [process.env.ZALO_OA_USER_ANH_NGOC  || '_none_ngoc']: { name: 'anh Ngọc', alias: 'anh-ngoc', role: 'TP Kinh Doanh' },
};

// ============================================================
// === SESSION MEMORY (file-based, in-process)
// ============================================================
const SESSION_DIR = '/root/.openclaw/zalo-oa-sessions';
try { fs.mkdirSync(SESSION_DIR, { recursive: true }); } catch (e) {}

function loadSession(userId) {
  const file = path.join(SESSION_DIR, `${userId}.json`);
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) {}
  return [];
}

function saveSession(userId, messages) {
  const file = path.join(SESSION_DIR, `${userId}.json`);
  try { fs.writeFileSync(file, JSON.stringify(messages.slice(-20), null, 2)); } catch (e) {}
}

function getSessionAgeMin(userId) {
  const file = path.join(SESSION_DIR, `${userId}.json`);
  try {
    if (fs.existsSync(file)) return Math.floor((Date.now() - fs.statSync(file).mtime.getTime()) / 60000);
  } catch (e) {}
  return Infinity;
}

// ============================================================
// === FOLLOWER PERSISTENT MEMORY — Google Sheet "Follower Memory"
// === A=user_id B=display_name C=first_seen D=last_seen
// === E=language F=topics_discussed G=last_message H=notes
// ============================================================
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const FOLLOWER_SHEET = "'Follower Memory'";

async function loadFollowerProfile(userId) {
  try {
    const { stdout } = await execFileAsync('node', [
      `${GTOOL}/sheets-read.js`, SHEET_ID, `${FOLLOWER_SHEET}!A:H`
    ], { encoding: 'utf-8', timeout: 15000 });
    for (const line of stdout.trim().split('\n').filter(Boolean)) {
      try {
        const row = JSON.parse(line);
        if (Array.isArray(row) && row[0] === userId) {
          return { userId: row[0], name: row[1] || null, firstSeen: row[2], lastSeen: row[3], language: row[4] || 'vi', topics: row[5] || '', lastMessage: row[6] || '', notes: row[7] || '' };
        }
      } catch (e) {}
    }
  } catch (e) { console.log(`[mem:load] ${e.message}`); }
  return null;
}

async function saveFollowerProfile(userId, name, language, topic, lastMessage) {
  const now = new Date().toISOString();
  try {
    const { stdout } = await execFileAsync('node', [`${GTOOL}/sheets-read.js`, SHEET_ID, `${FOLLOWER_SHEET}!A:A`], { encoding: 'utf-8', timeout: 15000 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    let rowNum = -1;
    for (let i = 0; i < lines.length; i++) {
      try {
        const cell = JSON.parse(lines[i]);
        const val = Array.isArray(cell) ? cell[0] : cell;
        if (val === userId) { rowNum = i + 1; break; }
      } catch (e) {}
    }
    if (rowNum > 0) {
      await execFileAsync('node', [`${GTOOL}/sheets-write.js`, SHEET_ID, `${FOLLOWER_SHEET}!D${rowNum}:G${rowNum}`, JSON.stringify([[now, language, topic.substring(0, 100), lastMessage.substring(0, 100)]])], { encoding: 'utf-8', timeout: 15000 });
    } else {
      await execFileAsync('node', [`${GTOOL}/sheets-append.js`, SHEET_ID, `${FOLLOWER_SHEET}!A:H`, JSON.stringify([[userId, name, now, now, language, topic.substring(0, 100), lastMessage.substring(0, 100), '']])], { encoding: 'utf-8', timeout: 15000 });
    }
  } catch (e) { console.log(`[mem:save] ${e.message}`); }
}

// ============================================================
// === TOOLS
// ============================================================
const VIP_TOOLS = [
  { name: 'email_send', description: 'Gửi email.', input_schema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, cc: { type: 'string' } }, required: ['to', 'subject', 'body'] } },
  { name: 'email_read', description: 'Đọc email gần đây.', input_schema: { type: 'object', properties: { hours: { type: 'number' }, max: { type: 'number' }, query: { type: 'string' } }, required: ['hours'] } },
  { name: 'email_reply', description: 'Reply thread email.', input_schema: { type: 'object', properties: { message_id: { type: 'string' }, body: { type: 'string' }, cc: { type: 'string' } }, required: ['message_id', 'body'] } },
  { name: 'calendar_read', description: 'Đọc lịch hẹn.', input_schema: { type: 'object', properties: { days: { type: 'number' } } } },
  { name: 'calendar_create', description: 'Tạo lịch hẹn.', input_schema: { type: 'object', properties: { title: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, description: { type: 'string' }, location: { type: 'string' } }, required: ['title', 'start', 'end'] } },
  { name: 'sheets_read', description: 'Đọc Google Sheet.', input_schema: { type: 'object', properties: { range: { type: 'string' } }, required: ['range'] } },
  { name: 'sheets_write', description: 'GHI ĐÈ Google Sheet.', input_schema: { type: 'object', properties: { range: { type: 'string' }, values: { type: 'string' } }, required: ['range', 'values'] } },
  { name: 'sheets_append', description: 'THÊM DÒNG Google Sheet.', input_schema: { type: 'object', properties: { range: { type: 'string' }, values: { type: 'string' } }, required: ['range', 'values'] } },
  { name: 'hvac_lookup', description: 'Tra cứu HVAC knowledge base từ Google Sheet gốc.', input_schema: { type: 'object', properties: { keyword: { type: 'string' }, range: { type: 'string' } } } },
  { name: 'memory_search', description: 'Tra cứu long-term memory.', input_schema: { type: 'object', properties: { keyword: { type: 'string' }, file: { type: 'string' } }, required: ['keyword'] } },
  { name: 'memory_update', description: 'Lưu kiến thức mới.', input_schema: { type: 'object', properties: { topic: { type: 'string' }, content: { type: 'string' }, section: { type: 'string' } }, required: ['topic', 'content'] } },
  { name: 'gdoc_create', description: 'Tạo Google Doc.', input_schema: { type: 'object', properties: { title: { type: 'string' }, content: { type: 'string' } }, required: ['title', 'content'] } },
  { name: 'task_add', description: 'Tạo task.', input_schema: { type: 'object', properties: { task: { type: 'string' }, assignee: { type: 'string' }, deadline: { type: 'string' }, source: { type: 'string' } }, required: ['task', 'assignee', 'deadline'] } },
  { name: 'task_overdue', description: 'Task quá hạn.', input_schema: { type: 'object', properties: {} } },
  { name: 'task_status', description: 'Tổng hợp task.', input_schema: { type: 'object', properties: {} } },
  { name: 'task_update', description: 'Cập nhật task.', input_schema: { type: 'object', properties: { row: { type: 'number' }, status: { type: 'string' } }, required: ['row', 'status'] } },
  { name: 'zalo_oa_send_to_vip', description: 'Gửi tin nhắn VIP.', input_schema: { type: 'object', properties: { target: { type: 'string', enum: ['sep-khanh', 'chi-hong', 'anh-ngoc'] }, message: { type: 'string' } }, required: ['target', 'message'] } },
  { name: 'zalo_oa_history', description: 'Lịch sử Zalo OA VIP.', input_schema: { type: 'object', properties: { target: { type: 'string', enum: ['all', 'sep-khanh', 'chi-hong', 'anh-ngoc'] }, hours: { type: 'number' } } } },
  { name: 'github_create_issue', description: 'Tạo GitHub Issue.', input_schema: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, requester: { type: 'string' } }, required: ['title', 'body', 'requester'] } },
  { name: 'kpi_update', description: 'Cập nhật KPI.', input_schema: { type: 'object', properties: {} } },
  { name: 'zalo_oa_article', description: 'Đăng bài OA.', input_schema: { type: 'object', properties: { action: { type: 'string', default: 'create' }, title: { type: 'string' }, body: { type: 'string' }, cover: { type: 'string' } }, required: ['title', 'body'] } },
  { name: 'image_overlay', description: 'Ghép logo lên ảnh.', input_schema: { type: 'object', properties: { input_image: { type: 'string' }, text: { type: 'string' }, output_path: { type: 'string' }, layout: { type: 'string' } }, required: ['input_image'] } },
  { name: 'gemini_write', description: 'Gemini soạn nội dung (FREE).', input_schema: { type: 'object', properties: { prompt: { type: 'string' }, max_tokens: { type: 'number' } }, required: ['prompt'] } },
  { name: 'drive_list', description: 'Liệt kê Drive.', input_schema: { type: 'object', properties: { folder_id: { type: 'string' }, query: { type: 'string' }, max: { type: 'number' } } } },
  { name: 'drive_download', description: 'Tải file Drive.', input_schema: { type: 'object', properties: { file_id: { type: 'string' }, output_path: { type: 'string' } }, required: ['file_id'] } },
  { name: 'web_search', description: 'Tìm kiếm web.', input_schema: { type: 'object', properties: { query: { type: 'string' }, max_results: { type: 'number' } }, required: ['query'] } },
  { name: 'web_read', description: 'Đọc trang web.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'auto_learn', description: 'Quét session extract insights.', input_schema: { type: 'object', properties: { target: { type: 'string' }, hours: { type: 'number' } } } },
  { name: 'zalo_oa_comment', description: 'Comment bài viết OA.', input_schema: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'reply', 'scan', 'scan-article'] }, article_id: { type: 'string' }, comment_id: { type: 'string' }, message: { type: 'string' }, hours: { type: 'number' } }, required: ['action'] } }
];

const FOLLOWER_TOOLS = [
  { name: 'web_search', description: 'Search web for current HVAC standards, news, or product info not in KB.', input_schema: { type: 'object', properties: { query: { type: 'string' }, max_results: { type: 'number' } }, required: ['query'] } },
  { name: 'web_read', description: 'Read a specific web page for detailed content.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'memory_search', description: 'Search Lê Na long-term memory for STARDUCT/HVAC facts.', input_schema: { type: 'object', properties: { keyword: { type: 'string' }, file: { type: 'string' } }, required: ['keyword'] } }
];

async function runTool(name, input) {
  let cmd, args;
  switch (name) {
    case 'email_send':    cmd = 'node'; args = [`${GTOOL}/gmail-send.js`, input.to, input.subject, input.body, input.cc || '', '']; break;
    case 'email_read':    cmd = 'node'; args = [`${GTOOL}/gmail-read.js`, String(input.hours), String(input.max || 20), input.query || '']; break;
    case 'email_reply':   cmd = 'node'; args = [`${GTOOL}/gmail-reply.js`, input.message_id, input.body, input.cc || '']; break;
    case 'calendar_read': cmd = 'node'; args = [`${GTOOL}/calendar-read.js`, String(input.days || 7)]; break;
    case 'calendar_create': cmd = 'node'; args = [`${GTOOL}/calendar-create.js`, input.title, input.start, input.end, input.description || '', input.location || '']; break;
    case 'sheets_read':   cmd = 'node'; args = [`${GTOOL}/sheets-read.js`, SHEET_ID, input.range]; break;
    case 'sheets_write':  cmd = 'node'; args = [`${GTOOL}/sheets-write.js`, SHEET_ID, input.range, input.values]; break;
    case 'sheets_append': cmd = 'node'; args = [`${GTOOL}/sheets-append.js`, SHEET_ID, input.range, input.values]; break;
    case 'hvac_lookup':   cmd = 'node'; args = [`${GTOOL}/hvac-lookup.js`, input.keyword || '', input.range || 'A:Z']; break;
    case 'memory_search': cmd = 'node'; args = [`${GTOOL}/memory-search.js`, input.keyword || '', input.file || '']; break;
    case 'memory_update': cmd = 'node'; args = [`${GTOOL}/memory-update.js`, input.topic || '', input.content || '', input.section || '']; break;
    case 'gdoc_create':   cmd = 'node'; args = [`${GTOOL}/gdoc-create.js`, input.title, input.content]; break;
    case 'task_add':      cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'add', input.task, input.assignee, input.deadline, input.source || '']; break;
    case 'task_overdue':  cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'overdue']; break;
    case 'task_status':   cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'status']; break;
    case 'task_update':   cmd = 'node'; args = [`${GTOOL}/task-tracker.js`, 'update', String(input.row), input.status]; break;
    case 'zalo_oa_send_to_vip': cmd = 'node'; args = [`${GTOOL}/zalo-oa-send.js`, input.target, input.message]; break;
    case 'zalo_oa_history': cmd = 'node'; args = [`${GTOOL}/zalo-oa-history.js`, input.target || 'all', String(input.hours || 24)]; break;
    case 'kpi_update':    cmd = 'node'; args = [`${GTOOL}/kpi-update.js`]; break;
    case 'zalo_oa_article': cmd = 'node'; args = [`${GTOOL}/zalo-oa-article.js`, input.action || 'create', input.title || '', input.body || '', input.cover || '']; break;
    case 'github_create_issue': cmd = 'node'; args = [`${GTOOL}/github-issue.js`, input.title, input.body, input.requester || '']; break;
    case 'image_overlay': cmd = 'node'; args = [`${GTOOL}/image-overlay.js`, input.input_image, input.text || '', input.output_path || `/tmp/cover-${Date.now()}.png`, input.layout || 'hero']; break;
    case 'gemini_write':  cmd = 'node'; args = [`${GTOOL}/gemini-write.js`, input.prompt, String(input.max_tokens || 600)]; break;
    case 'drive_list':    cmd = 'node'; args = [`${GTOOL}/drive-list.js`, input.folder_id || '1cLP2jBglCctc_l1wh7MoQmhycdZzOxsR', input.query || '', String(input.max || 30)]; break;
    case 'drive_download': cmd = 'node'; args = [`${GTOOL}/drive-download.js`, input.file_id, input.output_path || '']; break;
    case 'web_search':    cmd = 'node'; args = [`${GTOOL}/web-search.js`, input.query || '', String(input.max_results || 10)]; break;
    case 'web_read':      cmd = 'node'; args = [`${GTOOL}/web-read.js`, input.url || '']; break;
    case 'auto_learn':    cmd = 'node'; args = [`${GTOOL}/auto-learn.js`, input.target || 'all', String(input.hours || 24)]; break;
    case 'zalo_oa_comment': {
      const a = input.action || 'scan';
      if (a === 'list') { cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'list', input.article_id || '', '0', '20']; }
      else if (a === 'reply') { cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'reply', input.comment_id || '', input.message || '', input.article_id || '']; }
      else if (a === 'scan-article') { cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'scan-article', input.article_id || '', String(input.hours || 720)]; }
      else { cmd = 'node'; args = [`${GTOOL}/zalo-oa-comment.js`, 'scan', String(input.hours || 24)]; }
      break;
    }
    default: return { error: `Unknown tool: ${name}` };
  }
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { encoding: 'utf-8', timeout: 60000 });
    if (stderr) console.log(`[tool:${name}] ${stderr.trim()}`);
    const raw = stdout || '';
    return { output: raw.length > 3000 ? raw.substring(0, 3000) + '\n⚠️ [Truncated]' : raw };
  } catch (e) {
    if (e.stderr) console.log(`[tool:${name}] ${e.stderr.trim()}`);
    return { error: (e.stderr || e.stdout || e.message || 'unknown').substring(0, 1000) };
  }
}

// ============================================================
// === EXPRESS
// ============================================================
const app = express();
app.set('trust proxy', true);

app.use((req, res, next) => {
  const fp = path.join(PUBLIC_DIR, req.path);
  if (req.method === 'GET' && fs.existsSync(fp) && fs.statSync(fp).isFile()) return res.sendFile(fp);
  next();
});

// ============================================================
// === WEBHOOK
// ============================================================
const _webhookDedup = new Set();

app.post('/zalo-webhook', express.json({ limit: '5mb' }), (req, res) => {
  res.json({ status: 'ok' });
  const event = req.body;
  const msgId = event.message?.msg_id;
  if (msgId) {
    if (_webhookDedup.has(msgId)) { console.log(`[webhook] dedup: ${msgId}`); return; }
    _webhookDedup.add(msgId);
    setTimeout(() => _webhookDedup.delete(msgId), 60000);
  }
  try { fs.appendFileSync('/root/.openclaw/zalo-events.jsonl', JSON.stringify({ time: new Date().toISOString(), event }) + '\n'); } catch (e) {}
  console.log(`[webhook] ${event.event_name} from ${event.sender?.id || event.follower?.id || '?'}`);
  if (event.event_name === 'user_send_text' || event.event_name === 'user_send_link') {
    handleUserMessage(event).catch(err => console.error('[handler]', err.message));
  } else if (event.event_name === 'follow') {
    handleFollow(event).catch(err => console.error('[follow]', err.message));
  } else if (event.event_name === 'unfollow') {
    handleUnfollow(event).catch(err => console.error('[unfollow]', err.message));
  } else if (event.event_name === 'user_send_image') {
    handleImageMessage(event).catch(err => console.error('[image]', err.message));
  } else if (['user_send_comment', 'oa_comment', 'user_comment_article'].includes(event.event_name)) {
    handleArticleComment(event).catch(err => console.error('[comment]', err.message));
  }
});

app.get('/zalo-webhook', (req, res) => res.json({ status: 'active' }));

// ============================================================
// === FOLLOW / UNFOLLOW / IMAGE / COMMENT
// ============================================================
const FOLLOWERS_FILE = '/root/.openclaw/zalo-oa-followers.json';

function lookupFollower(userId) {
  try { return JSON.parse(fs.readFileSync(FOLLOWERS_FILE, 'utf-8')).find(f => f.user_id === userId); } catch (e) { return null; }
}

async function handleFollow(event) {
  const userId = event.follower?.id;
  if (!userId) return;
  let displayName = 'Unknown';
  try {
    const res = await fetch(`https://openapi.zalo.me/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`, { headers: { 'access_token': getOAToken() } });
    displayName = (await res.json()).data?.display_name || 'Unknown';
  } catch (e) {}
  console.log(`[follow] ${displayName} (${userId})`);
  let followers = [];
  try { followers = JSON.parse(fs.readFileSync(FOLLOWERS_FILE, 'utf-8')); } catch (e) {}
  const idx = followers.findIndex(f => f.user_id === userId);
  if (idx >= 0) { followers[idx].display_name = displayName; followers[idx].last_follow = new Date().toISOString(); }
  else followers.push({ user_id: userId, display_name: displayName, followed_at: new Date().toISOString() });
  try { fs.writeFileSync(FOLLOWERS_FILE, JSON.stringify(followers, null, 2)); } catch (e) {}
}

async function handleUnfollow(event) {
  const userId = event.follower?.id;
  if (!userId) return;
  const vip = VIP_USERS[userId];
  console.log(`[unfollow] ${vip ? vip.name : userId}`);
  if (vip) {
    const sepId = process.env.ZALO_OA_USER_SEP_KHANH;
    if (sepId && userId !== sepId) await sendZaloMessage(sepId, `⚠️ ${vip.name} đã unfollow OA Starasia JSC.`).catch(() => {});
  }
}

async function handleImageMessage(event) {
  const senderId = event.sender?.id;
  if (!senderId) return;
  const vip = VIP_USERS[senderId];
  const name = vip ? vip.name : (lookupFollower(senderId)?.display_name || 'anh/chị');
  const att = event.message?.attachments?.[0];
  const imageUrl = att?.payload?.url || att?.payload?.thumbnail || '';
  console.log(`[image] from ${name}: ${imageUrl.substring(0, 80)}`);
  await sendZaloMessage(senderId, `Dạ ${name}, em đã nhận ảnh.${vip ? ' Anh/chị muốn em làm gì với ảnh này ạ?' : ' Cảm ơn anh/chị!'}`);
}

async function handleArticleComment(event) {
  const commentId = event.comment?.id || event.comment_id || event.message?.comment_id;
  const text = event.comment?.message || event.comment?.text || event.message?.text || '';
  if (!commentId || !text) return;
  console.log(`[comment] from ${event.sender?.id || '?'}: ${text.substring(0, 80)}`);
  try {
    const { stdout } = await execFileAsync('node', [`${GTOOL}/zalo-oa-comment.js`, 'scan', '1'], { encoding: 'utf-8', timeout: 30000 });
    console.log(`[comment:scan] ${stdout.trim().substring(0, 200)}`);
  } catch (e) { console.error(`[comment] scan failed: ${e.message}`); }
}

// ============================================================
// === FOLLOWER HANDLER — Haiku + KB (embedded) + tools + memory
// ============================================================
async function handleFollowerMessage(senderId, messageText) {
  const follower = lookupFollower(senderId);
  const zaloName = follower?.display_name || null;

  // Load persistent profile from Google Sheet (fire-and-forget on error)
  const profile = await loadFollowerProfile(senderId).catch(() => null);
  const knownName = profile?.name || zaloName || 'anh/chị';
  const isFirstContact = !profile;
  const lastTopics = profile?.topics || '';
  const lastSeen = profile?.lastSeen ? new Date(profile.lastSeen).toLocaleDateString('vi-VN') : null;

  console.log(`[follower] ${knownName} (${senderId}): ${messageText.substring(0, 80)}`);

  // In-memory short-term session
  let session = loadSession(senderId);
  if (!Array.isArray(session)) session = [];
  session.push({ role: 'user', content: messageText });
  if (session.length > 20) session.splice(0, session.length - 20);

  // Memory context
  const memCtx = isFirstContact
    ? 'USER MEMORY: First contact. No prior history. Introduce yourself briefly if appropriate.'
    : `USER MEMORY:\n- Name: ${knownName}\n- First contact: ${profile.firstSeen ? new Date(profile.firstSeen).toLocaleDateString('vi-VN') : 'unknown'}\n- Last seen: ${lastSeen || 'unknown'}\n- Previous topics: ${lastTopics || 'none recorded'}\n- Reference past interactions when relevant. Address them by name.`;

  const systemPrompt = `You are Lê Na — the official AI assistant of STARDUCT, Vietnam's leading air terminal manufacturer (NSCA — Ngoi Sao Chau A JSC, Dan Phuong, Hanoi, Vietnam). Website: starduct.vn

${memCtx}

━━━ LANGUAGE RULE (CRITICAL) ━━━
Detect language from the user's message. ALWAYS reply in the SAME language.
Vietnamese → reply Vietnamese (xưng "em", gọi "anh/chị" hoặc tên)
English → reply English ("I" / "you" or their name)
Never switch language unless the user does.

━━━ TOOLS — WHEN TO USE ━━━
web_search: user asks about latest standards, news, or anything possibly outdated in KB → SEARCH FIRST
web_read: user sends a URL or you found a useful URL via web_search → READ IT
memory_search: user references something they told you before, or topic seems familiar → SEARCH MEMORY
Simple HVAC calc/terminology in KB below → answer DIRECTLY, no tool call needed

━━━ RESPONSE STYLE ━━━
- Friendly, professional, concise (max 3-4 sentences unless calculation is needed)
- For calculations: show formula from KB → compute step by step → give result with unit
- Pricing/ordering: "Anh/chị liên hệ sales@nsca.vn hoặc hotline 0246.260.9999 ạ." / "Please contact sales@nsca.vn or +84 246 260 9999."
- Complex technical (submittals, specs, custom): "Gửi yêu cầu về info@nsca.vn, team R&D hỗ trợ trong 24h ạ." / "Send your request to info@nsca.vn, our R&D team responds within 24h."
- NEVER invent specs, model codes, pricing, or standards not in KB below
- NEVER mention internal matters, VIPs, or CEO name

${LENA_KB}`;

  // Agent loop (max 5 iter — lightweight for followers)
  let reply = '';
  let iters = 0;
  try {
    while (iters++ < 5) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: CLAUDE_MODEL_HAIKU, max_tokens: 500, system: systemPrompt, tools: FOLLOWER_TOOLS, messages: session })
      });
      if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.stop_reason === 'tool_use') {
        session.push({ role: 'assistant', content: data.content });
        const results = [];
        for (const blk of data.content) {
          if (blk.type === 'tool_use') {
            console.log(`[follower:tool] ${blk.name}(${JSON.stringify(blk.input).substring(0, 60)})`);
            results.push({ type: 'tool_result', tool_use_id: blk.id, content: JSON.stringify(await runTool(blk.name, blk.input)) });
          }
        }
        session.push({ role: 'user', content: results });
      } else {
        reply = data.content?.find(c => c.type === 'text')?.text || '';
        session.push({ role: 'assistant', content: data.content });
        break;
      }
    }
  } catch (e) {
    console.error(`[follower] error: ${e.message}`);
    reply = 'Xin lỗi anh/chị, em đang gặp sự cố kỹ thuật. Vui lòng liên hệ info@nsca.vn ạ.\n\nSorry, technical issue. Please contact info@nsca.vn.';
  }

  if (!reply) reply = 'Xin lỗi anh/chị, em chưa xử lý được yêu cầu này. Liên hệ info@nsca.vn để được hỗ trợ ạ.';

  saveSession(senderId, session);

  // Detect language for memory
  const isVietnamese = /[àáảãạăắặẳẵặâấậầẩẫđèéẻẽẹêếệềểễìíỉĩịòóỏõọôốộồổỗơớợờởỡùúủũụưứựừửữỳýỷỹỵ]/i.test(messageText);
  const detectedLang = isVietnamese ? 'vi' : 'en';

  // Persist profile (fire-and-forget)
  saveFollowerProfile(senderId, knownName, detectedLang, messageText.substring(0, 100), messageText).catch(() => {});

  if (reply) {
    await sendZaloMessage(senderId, reply);
    console.log(`[follower] → ${knownName}: ${reply.substring(0, 80)}...`);
  }
}

// ============================================================
// === VIP HANDLER — full agent loop (Haiku + all tools)
// ============================================================
async function handleUserMessage(event) {
  const senderId = event.sender?.id;
  let messageText = event.message?.text || '';

  if (event.event_name === 'user_send_link') {
    const urls = (event.message?.attachments || []).filter(a => a?.type === 'link' && a?.payload?.url).map(a => a.payload.url);
    const missing = urls.filter(u => !messageText.includes(u));
    if (missing.length) messageText = messageText ? `${messageText}\n${missing.join('\n')}` : missing.join('\n');
  }

  if (!senderId || !messageText) return;

  const vip = VIP_USERS[senderId];

  // Non-VIP → follower handler
  if (!vip) { await handleFollowerMessage(senderId, messageText); return; }

  const senderInfo = `${vip.name} (${vip.role})`;
  console.log(`[vip] ${senderInfo}: ${messageText.substring(0, 60)}...`);

  const sessionAgeMin = getSessionAgeMin(senderId);
  let session = loadSession(senderId);
  if (!Array.isArray(session)) session = [];
  // Reset orphaned tool_result
  if (session.length > 0) {
    const last = session[session.length - 1];
    if (last.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') { session = []; }
  }

  const isFresh = session.length === 0 || sessionAgeMin >= 360;
  session.push({ role: 'user', content: messageText });

  const today = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const systemPrompt = `Bạn là **Đào Thị Lê Na**, trợ lý AI của CEO Đào Huy Khánh (NSCA/STARDUCT).
Đang chat với: **${senderInfo}** | Thời gian: ${today}

${isFresh
  ? `Session MỚI — có thể mở đầu ngắn "Dạ ${vip.name}..." 1 lần rồi vào nội dung.`
  : `Session ACTIVE (${sessionAgeMin}p trước) — KHÔNG chào, trả lời THẲNG.`}

NGUYÊN TẮC: Xưng "em" | Ngắn gọn, có số liệu | KHÔNG ký tên | Max 500 ký tự/tin
LUẬT 1 — KHÔNG HỎI: VIP ra lệnh → GỌI TOOL NGAY. KHÔNG đưa options, KHÔNG hỏi lại.
LINK: web_search verify TRƯỚC khi gửi bất kỳ link nào.
CODE/CRON: Sếp nói "sửa/thêm/fix" → github_create_issue NGAY, tự viết title+body.
SHEET: ID đã có sẵn — chỉ cần truyền range. 3 VIP ĐỘC LẬP — không chia sẻ chéo.`;

  let reply = '';
  let iters = 0;
  try {
    while (iters++ < 15) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: CLAUDE_MODEL_HAIKU, max_tokens: 2000, system: systemPrompt, tools: VIP_TOOLS, messages: session })
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[vip] Claude ${res.status}: ${err.substring(0, 200)}`);
        if (res.status === 400 && session.length > 1) { session = [{ role: 'user', content: messageText }]; continue; }
        throw new Error(`Claude ${res.status}`);
      }
      const data = await res.json();
      if (data.stop_reason === 'tool_use') {
        session.push({ role: 'assistant', content: data.content });
        const results = [];
        for (const blk of data.content) {
          if (blk.type === 'tool_use') {
            console.log(`[vip:tool] ${blk.name}(${JSON.stringify(blk.input).substring(0, 80)})`);
            results.push({ type: 'tool_result', tool_use_id: blk.id, content: JSON.stringify(await runTool(blk.name, blk.input)) });
          }
        }
        session.push({ role: 'user', content: results });
      } else {
        reply = data.content.find(c => c.type === 'text')?.text || '(em không có gì để nói)';
        session.push({ role: 'assistant', content: data.content });
        break;
      }
    }
  } catch (e) {
    console.error(`[vip] CRITICAL: ${e.message}`);
    reply = `Dạ ${vip.name}, em đang gặp trục trặc kỹ thuật, thử lại sau 1 phút nhé.`;
    session = [{ role: 'user', content: messageText }];
  }

  if (!reply) reply = 'Em xin lỗi, yêu cầu quá phức tạp. Anh/chị thử yêu cầu đơn giản hơn nhé.';
  saveSession(senderId, session);
  try {
    await sendZaloMessage(senderId, reply);
    console.log(`[vip] → ${vip.name}: ${reply.substring(0, 60)}...`);
  } catch (e) { console.error(`[vip] send FAILED: ${e.message}`); }
}

// ============================================================
// === SEND
// ============================================================
const _zaloSendCache = new Map();

async function sendZaloMessage(userId, message) {
  const now = Date.now();
  const last = _zaloSendCache.get(userId);
  if (last && now - last < 5000) { console.log(`[send] dedup ${userId}`); return; }
  _zaloSendCache.set(userId, now);
  const token = getOAToken();
  if (!token) throw new Error('No OA token');
  const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
    method: 'POST',
    headers: { 'access_token': token, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ recipient: { user_id: userId }, message: { text: `${message.trim()}\n\n— Lê Na` } })
  });
  const data = await res.json();
  if (data.error !== 0) throw new Error(`Zalo err ${data.error}: ${data.message}`);
  return data.data;
}

setInterval(() => { const now = Date.now(); for (const [k, v] of _zaloSendCache) if (now - v > 60000) _zaloSendCache.delete(k); }, 3600000);

// ============================================================
// === HEALTH / DEBUG / TOKEN
// ============================================================
app.get('/health', (req, res) => res.json({
  status: 'ok', uptime: Math.floor(process.uptime()),
  model: CLAUDE_MODEL_HAIKU,
  vips: Object.keys(VIP_USERS).filter(k => !k.startsWith('_none_')).length,
  vip_tools: VIP_TOOLS.length, follower_tools: FOLLOWER_TOOLS.length,
  kb_embedded: true, kb_chars: LENA_KB.length,
  follower_memory: 'Google Sheet — Follower Memory tab'
}));

app.get('/refresh-token', async (req, res) => res.json({ refreshed: await refreshOAToken(), token: !!getOAToken() }));

app.get('/debug', async (req, res) => {
  const vipList = {};
  for (const [id, info] of Object.entries(VIP_USERS)) if (!id.startsWith('_none_')) vipList[id.substring(0, 8) + '...'] = info.name;
  let claudeOk = false;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CLAUDE_MODEL_HAIKU, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] })
    });
    claudeOk = r.ok;
  } catch (e) {}
  res.json({ vips: vipList, claude_api: claudeOk ? 'OK' : 'FAIL', model: CLAUDE_MODEL_HAIKU, zalo_token: getOAToken() ? 'OK' : 'MISSING', kb_embedded: true, kb_chars: LENA_KB.length });
});

// ============================================================
// === PROXY TO OPENCLAW
// ============================================================
const ocProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${OPENCLAW_PORT}`, changeOrigin: true, ws: true, xfwd: true, logLevel: 'warn',
  onError: (err, req, res) => {
    console.error('[proxy]', err.message);
    if (res && !res.headersSent) { res.writeHead(502, { 'Content-Type': 'text/plain' }); res.end('Upstream not ready: ' + err.message); }
  }
});
app.use('/', ocProxy);

const server = app.listen(FRONT_PORT, '0.0.0.0', () => {
  console.log(`[proxy] Port ${FRONT_PORT} → OpenClaw ${OPENCLAW_PORT}`);
  console.log(`[proxy] Model: ${CLAUDE_MODEL_HAIKU} (all users)`);
  console.log(`[proxy] VIP tools: ${VIP_TOOLS.length} | Follower tools: ${FOLLOWER_TOOLS.length} (web_search, web_read, memory_search)`);
  console.log(`[proxy] KB embedded: ${LENA_KB.length} chars | Follower memory: Google Sheet "Follower Memory"`);
  const RI = 20 * 60 * 60 * 1000;
  refreshOAToken().then(ok => console.log(`[token] Startup: ${ok ? 'OK' : 'FAILED'}`)).catch(() => {});
  setInterval(() => refreshOAToken(), RI);
  console.log(`[token] Auto-refresh every 20h | Current: ${getOAToken() ? 'OK' : 'MISSING'}`);
});

server.on('upgrade', ocProxy.upgrade);
process.on('SIGTERM', () => { console.log('[proxy] SIGTERM'); server.close(() => process.exit(0)); });
