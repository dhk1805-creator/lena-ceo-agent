# LENA HVAC KNOWLEDGE BASE
**Source:** HVAC_Formulas_Dictionary (NSCA Internal)
**Version:** KB-1.1 | 2026-05-14
**Purpose:** Reference for Lê Na AI — HVAC consultation, terminology, STARDUCT product support

---

## CORE TRANSLATION RULES

1. **Tra cứu trước, dịch sau** — Bất kỳ thuật ngữ kỹ thuật nào phải tìm trong KB này trước
2. **Không chắc → giữ nguyên tiếng Anh** — Không phỏng đoán
3. **Đối chiếu nguồn** — Mọi bản dịch phải khớp Standard/Source trong KB
4. **Từ viết tắt chuẩn** — Giữ nguyên: AHU, FCU, VAV, VRF, COP, SHF, HEPA, MERV, CFM, ACH
5. **Số và đơn vị không dịch** — Pa, kPa, m³/h, CFM, °C, °F, kW, TR, RPM, NC
6. **Model codes KHÔNG dịch** — SAG600, DAG450, SKD600, SLD-A2S, SVAV-S, VCD, S-MFSD
7. **Standards KHÔNG dịch** — ASHRAE 70, UL 555, AMCA 500-D, EN 1366, TCVN 5687

---

## SECTION A — KEY FORMULAS (73 công thức)

### A1. Air & Psychrometrics / Nhiệt ẩm không khí
| # | Formula Name (EN) | VI | Formula | Unit |
|---|---|---|---|---|
| 1 | Dry Air Mass Flow | Lưu lượng khối khí khô | m_da = Q/[1.005×(T1-T3)] | kg/s |
| 2 | Humidity Ratio | Tỉ số ẩm | W = 0.29198×Pv/(P-Pv) | kg/kg dry air |
| 3 | Relative Humidity | Độ ẩm tương đối | φ = Pv/Pvs(Tdb)×100% | % |
| 4 | Enthalpy of Moist Air | Enthalpy không khí ẩm | h = 1.005×T + W×(2500+1.887×T) | kJ/kg dry air |
| 5 | Dew Point Temperature | Nhiệt độ điểm sương | From psychrometric chart | °C |
| 6 | Specific Volume | Thể tích riêng | v = 0.287042×(T+273.15)×(1+1.88715W)/P | m³/kg dry air |
| 7 | Density of Moist Air | Mật độ khí ẩm | ρ = 1/v | kg/m³ |
| 8 | Moisture Content | Hàm lượng ẩm | gr = W×1000 | grains/lb |

### A2. Heat & Load / Nhiệt & Tải lạnh
| # | Formula Name (EN) | VI | Formula | Unit |
|---|---|---|---|---|
| 9 | Sensible Heat | Nhiệt hiện | Qs = 1.23×CFM×(T1-T3) | Btu/hr |
| 10 | Latent Heat | Nhiệt ẩn | Ql = 0.44×CFM×(W1-W3) | Btu/hr |
| 11 | Total Heat | Tổng nhiệt | Qt = Qs + Ql | Btu/hr |
| 12 | Air Flow Rate | Lưu lượng không khí | CFM = Q/[1.23×(T1-T3)] | CFM |
| 13 | Cooling Load (Ton) | Tải lạnh | TR = Q/12000 | TR |
| 14 | Heating Load | Tải sưởi | Q = 1.1×CFM×(T_in-T_out) | W |
| 15 | Heat by Mass Flow | Nhiệt theo lưu lượng khối | Q = ṁ×Cp×(T1-T2) | kW |
| 16 | Sensible Heat Factor | Hệ số nhiệt hiện | SHF = Qs/Qt | — |
| 17 | Latent Heat Factor | Hệ số nhiệt ẩn | LHF = 1 - SHF | — |

### A3. Airflow & Duct / Lưu lượng & Đường ống gió
| # | Formula Name (EN) | VI | Formula | Unit |
|---|---|---|---|---|
| 19 | Air Velocity | Vận tốc không khí | V = Q/A | m/s |
| 20 | Flow from Velocity | Lưu lượng từ vận tốc | Q = V×A | CFM |
| 21 | Duct Area | Diện tích ống gió | A = Q/V | m² |
| 22 | Equivalent Diameter | Đường kính tương đương | D = √(4A/π) | mm |
| 23 | Reynolds Number | Số Reynolds | Re = ρVD/μ | — |
| 25 | Duct Friction Loss | Tổn thất ma sát ống | ΔP = f×(L/D)×(ρV²/2) | Pa |
| 26 | Velocity Pressure (in.wg) | Áp suất động | VP = ρV²/2×(1/g) | in.w.g. |
| 27 | Velocity Pressure (Pa) | Áp suất tốc độ | Pv = ρV²/2 | Pa |
| 28 | Air Changes per Hour | Số lần thay khí/giờ | ACH = CFM×60/Vol | /hr |

### A4. Fan & Pump Laws / Định luật quạt & bơm
| # | Formula | VI | Rule |
|---|---|---|---|
| 42 | Q1/Q2 = N1/N2 | Tỉ lệ lưu lượng | Flow ratio |
| 43 | P1/P2 = (N1/N2)² | Tỉ lệ áp suất | Pressure ratio |
| 44 | HP1/HP2 = (N1/N2)³ | Tỉ lệ công suất | Power ratio |
| 46 | BP = Q×ΔP/η | Công suất trục | Brake Power |

### A5. Refrigeration / Chu trình lạnh
| # | Formula | VI | Note |
|---|---|---|---|
| 36 | RE = h1-h4 | Hiệu ứng lạnh | Refrigeration Effect |
| 37 | W = h2-h1 | Công nén | Compressor Work |
| 39 | COP = RE/W = (h1-h4)/(h2-h1) | Hệ số hiệu suất lạnh | COP |
| 40 | ṁ = Q/(h1-h4) | Lưu lượng môi chất | Refrigerant mass flow |

### A6. Unit Conversions / Đổi đơn vị
| Conversion | Value |
|---|---|
| 1 TR | = 3.517 kW = 12,000 Btu/hr |
| 1 CFM | = 0.4719 L/s |
| 1 kW | = 3412 Btu/hr |
| 1 in.wg | = 249.1 Pa |
| 1 kPa | = 4.015 in.w.g. |
| °C → °F | T(°F) = 9/5×T(°C)+32 |
| 1 kg/s | = 2.2040 lb/s |

---

## SECTION B — SYMBOL REFERENCE / Ký hiệu
| Symbol | Meaning EN | Meaning VI | SI Unit | IP Unit |
|---|---|---|---|---|
| T | Temperature | Nhiệt độ | °C | °F |
| P | Pressure | Áp suất | Pa / kPa | psi / in.wg |
| Q | Heat / Airflow | Nhiệt lượng / Lưu lượng | W / m³/s | Btu/hr / CFM |
| W | Humidity Ratio | Tỉ số ẩm | kg/kg dry air | lb/lb |
| φ | Relative Humidity | Độ ẩm tương đối | % | % |
| h | Enthalpy | Enthalpy | kJ/kg | Btu/lb |
| ρ | Density | Mật độ | kg/m³ | lb/ft³ |
| V | Velocity | Vận tốc | m/s | fpm |
| A | Area | Diện tích | m² | ft² |
| D | Diameter | Đường kính | mm | inch |
| COP | Coefficient of Performance | Hệ số hiệu suất | — | — |
| TR | Ton of Refrigeration | Tấn lạnh | 3.517 kW | 12,000 Btu/hr |
| CFM | Cubic Feet per Minute | Feet khối/phút | 0.4719 L/s | ft³/min |
| ACH | Air Changes per Hour | Số lần thay khí/giờ | /hr | /hr |
| SHF | Sensible Heat Factor | Hệ số nhiệt hiện | — | — |
| ΔT | Temperature Difference | Hiệu nhiệt độ | K or °C | °F |
| ΔP | Pressure Difference | Hiệu áp suất | Pa | in.wg |
| ṁ | Mass Flow Rate | Lưu lượng khối | kg/s | lb/hr |
| Cp | Specific Heat | Nhiệt dung riêng | kJ/kg·K | Btu/lb·°F |

---

## SECTION C — MULTILINGUAL GLOSSARY (252 terms)
**Format:** English | Tiếng Việt | 中文 | 한국어 | 日本語 | Español | [Standard]

### C1. Psychrometrics / Nhiệt ẩm học
Dry Bulb Temperature | Nhiệt độ bầu khô | 干球温度 | 건구온도 | 乾球温度 | Temperatura de bulbo seco [ASHRAE Fund.2021]
Wet Bulb Temperature | Nhiệt độ bầu ướt | 湿球温度 | 습구온도 | 湿球温度 | Temperatura de bulbo húmedo [ASHRAE Fund.2021]
Dew Point Temperature | Nhiệt độ điểm sương | 露点温度 | 이슬점 온도 | 露点温度 | Temperatura de punto de rocío [ASHRAE 55-2023]
Relative Humidity (RH) | Độ ẩm tương đối | 相对湿度 | 상대습도 | 相対湿度 | Humedad relativa [ASHRAE 55-2023]
Absolute Humidity | Độ ẩm tuyệt đối | 绝对湿度 | 절대습도 | 絶対湿度 | Humedad absoluta [ASHRAE Fund.2021]
Humidity Ratio (W) | Tỉ số ẩm | 含湿量 | 비습도 | 比湿 | Razón de humedad [ASHRAE Fund.2021]
Specific Enthalpy (h) | Enthalpy riêng | 比焓 | 비엔탈피 | 比エンタルピー | Entalpía específica [ASHRAE Fund.2021]
Psychrometric Chart | Biểu đồ nhiệt ẩm | 焓湿图 | 습공기선도 | 湿り空気線図 | Diagrama psicrométrico [ASHRAE Fund.2021]
Sensible Heat | Nhiệt hiện | 显热 | 현열 | 顕熱 | Calor sensible [ASHRAE Fund.2021]
Latent Heat | Nhiệt ẩn | 潜热 | 잠열 | 潜熱 | Calor latente [ASHRAE Fund.2021]
Sensible Heat Ratio (SHR) | Hệ số nhiệt hiện | 显热比 | 현열비 | 顕熱比 | Relación de calor sensible [ASHRAE Fund.2021]
Evaporative Cooling | Làm lạnh bay hơi | 蒸发冷却 | 증발냉각 | 蒸発冷却 | Enfriamiento evaporativo [ASHRAE Fund.2021]

### C2. Airflow & Duct / Lưu lượng & Hệ thống ống gió
Static Pressure (SP) | Áp suất tĩnh | 静压 | 정압 | 静圧 | Presión estática [SMACNA 2006]
Velocity Pressure (VP) | Áp suất động | 动压 | 동압 | 動圧 | Presión dinámica [SMACNA 2006]
Total Pressure (TP) | Tổng áp suất | 全压 | 총압 | 全圧 | Presión total [SMACNA 2006]
External Static Pressure | Áp suất tĩnh ngoài | 外部静压 | 외부정압 | 外部静圧 | Presión estática externa [AMCA 210]
Aspect Ratio | Tỉ lệ cạnh | 长宽比 | 종횡비 | アスペクト比 | Relación de aspecto [SMACNA 2006]
Equivalent Diameter | Đường kính tương đương | 当量直径 | 등가직경 | 等価直径 | Diámetro equivalente [SMACNA/ASHRAE]
Duct Leakage Class | Cấp rò rỉ ống gió | 管道泄漏等级 | 덕트 누설 등급 | ダクト漏気クラス | Clase de fugas [SMACNA]
Flexible Duct | Ống gió mềm | 软风管 | 플렉시블 덕트 | フレキシブルダクト | Ducto flexible [UL 181]
Plenum | Buồng khí trung gian | 静压箱 | 플레넘 | プレナム | Plenum [ASHRAE/NFPA 90A]
Air Handling Unit (AHU) | Bộ xử lý không khí | 空气处理机组 | 공조기 | 空調機 | Unidad manejadora [AHRI 430]
Fan Coil Unit (FCU) | Dàn lạnh quạt cuộn | 风机盘管 | 팬코일유닛 | ファンコイルユニット | Ventiloconvector [AHRI 440]
Terminal Unit | Thiết bị đầu cuối | 末端装置 | 터미널 유닛 | ターミナルユニット | Unidad terminal [AHRI 880]
Variable Air Volume (VAV) | Hệ thống lưu lượng biến đổi | 变风量系统 | VAV 시스템 | 変風量システム | Volumen de aire variable [AHRI 880]
Constant Air Volume (CAV) | Hệ thống lưu lượng cố định | 定风量系统 | CAV 시스템 | 定風量システム | Volumen de aire constante [ASHRAE]
Return Air (RA) | Không khí hồi | 回风 | 리턴 에어 | 還気 | Aire de retorno [ASHRAE 62.1]
Supply Air (SA) | Không khí cấp | 送风 | 급기 | 給気 | Aire de suministro [ASHRAE 62.1]
Exhaust Air (EA) | Không khí thải | 排风 | 배기 | 排気 | Aire de extracción [ASHRAE 62.1]
Outdoor Air (OA) | Không khí ngoài trời | 室外空气 | 외기 | 外気 | Aire exterior [ASHRAE 62.1]
Mixed Air (MA) | Không khí hỗn hợp | 混合空气 | 혼합 공기 | 混合空気 | Aire mezclado [ASHRAE 62.1]
Frictional Pressure Loss | Tổn thất áp suất ma sát | 摩擦压降 | 마찰 압력 손실 | 摩擦圧力損失 | Pérdida por fricción [SMACNA/ASHRAE]
Local Resistance (Minor Loss) | Tổn thất cục bộ | 局部阻力损失 | 국부저항 | 局部抵抗 | Pérdida menor [SMACNA 2006]
Air Diffuser | Miệng khuếch tán | 散流器 | 디퓨저 | ディフューザー | Difusor de aire [ASHRAE/AMCA]
Slot Diffuser | Miệng thổi khe | 线型散流器 | 슬롯 디퓨저 | スロットディフューザー | Difusor de ranura [ASHRAE 70]
Grille | Miệng lưới | 格栅 | 그릴 | グリル | Rejilla [ASHRAE/AMCA]
Register | Miệng gió có van điều chỉnh | 带调节阀格栅 | 레지스터 | レジスター | Registro [ASHRAE/AMCA]
Damper | Van gió / Cánh gió | 风阀 | 댐퍼 | ダンパー | Compuerta [AMCA 500-D]
Balancing Damper | Van cân bằng lưu lượng | 平衡阀 | 균형 댐퍼 | バランスダンパー | Compuerta de equilibrado [AMCA 500-D]
Volume Control Damper (VCD) | Van điều chỉnh lưu lượng | 风量调节阀 | VCD 댐퍼 | 風量調節ダンパー | Compuerta reguladora [AMCA 500-D]
Fire Damper | Van ngăn cháy | 防火阀 | 방화댐퍼 | 防火ダンパー | Compuerta cortafuego [UL 555]
Smoke Damper | Van ngăn khói | 防烟阀 | 연기댐퍼 | 防煙ダンパー | Compuerta de humos [UL 555S]
Combination Fire/Smoke Damper | Van ngăn cháy-khói kết hợp | 防火防烟阀 | 복합 방화/연기 댐퍼 | 防火防煙ダンパー | Compuerta combinada [UL 555/555S]
Backdraft Damper | Van chống gió ngược | 止回风阀 | 역풍방지 댐퍼 | 逆流防止ダンパー | Compuerta antirretorno [AMCA 500-D]
Centrifugal Fan | Quạt ly tâm | 离心风机 | 원심 팬 | 遠心ファン | Ventilador centrífugo [AMCA 210]
EC Motor Fan | Quạt động cơ EC | 电子换向电机风机 | EC 모터 팬 | ECモーターファン | Ventilador EC [IEC 60034]
Fan Curve | Đường đặc tính quạt | 风机特性曲线 | 팬 커브 | ファン特性曲線 | Curva del ventilador [AMCA 210]
Throw (Air) | Tầm phun không khí | 射程 | 취출 거리 | 到達距離 | Alcance [ASHRAE 70]
Drop (Air) | Độ sụt luồng khí | 气流下沉量 | 에어 드롭 | エアドロップ | Caída del chorro [ASHRAE 70]
Coanda Effect | Hiệu ứng Coanda | 柯恩达效应 | 코안다 효과 | コアンダ効果 | Efecto Coandă [ASHRAE Fund.]
ADPI | Chỉ số hiệu suất khuếch tán khí | 空气扩散性能指数 | 공기확산성능지수 | 気流拡散性能指数 | ADPI [ASHRAE 70]
Effective Area (Ak) | Diện tích hiệu dụng | 有效面积 | 유효면적 | 有効面積 | Área efectiva [ASHRAE 70]
Neck Velocity | Vận tốc cổ miệng gió | 颈部风速 | 넥 풍속 | 首部風速 | Velocidad de cuello [ASHRAE 70]
Face Velocity | Vận tốc bề mặt miệng gió | 面风速 | 페이스 풍속 | フェース風速 | Velocidad facial [ASHRAE/AMCA]

### C3. Thermal Comfort / Tiện nghi nhiệt
PMV | Chỉ số dự báo cảm giác nhiệt | 预测平均热感觉 | PMV | 予測平均申告 | PMV [ASHRAE 55/ISO 7730]
PPD | Tỉ lệ người không thỏa mãn | 预测不满意率 | PPD | 予測不満足率 | PPD [ASHRAE 55/ISO 7730]
Operative Temperature | Nhiệt độ vận hành | 操作温度 | 작용온도 | 作用温度 | Temperatura operativa [ASHRAE 55-2023]
Mean Radiant Temperature (MRT) | Nhiệt độ bức xạ trung bình | 平均辐射温度 | 평균복사온도 | 平均放射温度 | MRT [ASHRAE 55/ISO 7726]
Adaptive Comfort Model | Mô hình tiện nghi thích nghi | 自适应舒适模型 | 적응형 쾌적 모델 | 適応型快適モデル | Confort adaptativo [ASHRAE 55/EN 16798]
Thermal Stratification | Phân tầng nhiệt độ | 热分层 | 열성층화 | 温度成層 | Estratificación térmica [ASHRAE 55-2023]
Local Thermal Discomfort | Khó chịu nhiệt cục bộ | 局部热不适 | 국소 열불쾌감 | 局所的熱不快感 | Disconfort local [ASHRAE 55-2023]

### C4. IAQ / IEQ / Chất lượng không khí trong nhà
Indoor Air Quality (IAQ) | Chất lượng không khí trong nhà | 室内空气质量 | 실내공기질 | 室内空気質 | Calidad del aire interior [WHO AQG/ASHRAE 62.1]
Indoor Environmental Quality (IEQ) | Chất lượng môi trường trong nhà | 室内环境质量 | 실내환경질 | 室内環境品質 | Calidad ambiental interior [EN 16798/WELL v2]
CO₂ Concentration | Nồng độ CO₂ | 二氧化碳浓度 | 이산화탄소 농도 | 二酸化炭素濃度 | Concentración CO₂ [ASHRAE 62.1]
PM2.5 | Hạt bụi mịn PM2.5 | 细颗粒物 PM2.5 | 초미세먼지 PM2.5 | 微小粒子状物質 | PM2.5 [WHO AQG 2021]
PM10 | Hạt bụi thô PM10 | 可吸入颗粒物 PM10 | 미세먼지 PM10 | 粒子状物質 PM10 | PM10 [WHO AQG 2021]
Total VOC (TVOC) | Tổng hợp chất hữu cơ bay hơi | 总挥发性有机物 | 총VOC | 総VOC | TVOC [WHO AQG 2021]
HEPA Filter | Bộ lọc HEPA | 高效空气过滤器 | 헤파 필터 | HEPAフィルター | Filtro HEPA [EN 1822/ISO 29463]
MERV Rating | Cấp lọc MERV | MERV过滤等级 | MERV 등급 | MERV評価 | MERV [ASHRAE 52.2]
Demand-Controlled Ventilation (DCV) | Thông gió theo nhu cầu | 需求控制通风 | 수요제어 환기 | 需要制御換気 | DCV [ASHRAE 62.1/90.1]
Displacement Ventilation | Thông gió đẩy thay thế | 置换通风 | 치환 환기 | 置換換気 | Ventilación por desplazamiento [ASHRAE 62.1]
Minimum Ventilation Rate | Tỉ lệ thông gió tối thiểu | 最小通风量 | 최소 환기량 | 最小換気量 | Caudal mínimo [ASHRAE 62.1/TCVN 5687]
Air Changes per Hour (ACH) | Số lần thay khí/giờ | 换气次数 | 시간당 환기 횟수 | 換気回数 | Cambios de aire [ASHRAE 62.1]
UV-C Germicidal Irradiation | Chiếu xạ diệt khuẩn UV-C | 紫外线C段杀菌 | UV-C 살균조사 | UV-C殺菌照射 | Irradiación UV-C [ASHRAE 62.1]

### C5. Refrigeration / Chu trình lạnh
COP | Hệ số hiệu suất lạnh | 性能系数 | 성능계수 | 成績係数 | COP [ASHRAE/ISO 13253]
EER | Tỉ số hiệu quả năng lượng | 能效比 | 에너지효율비 | エネルギー消費効率 | EER [AHRI 210/240]
SEER | Tỉ số hiệu quả theo mùa | 季节能效比 | 계절에너지효율비 | 期間エネルギー消費効率 | SEER [AHRI 210/240]
Chiller | Máy làm lạnh nước | 冷水机组 | 칠러 | チラー | Enfriadora [AHRI 550/590]
Cooling Tower | Tháp giải nhiệt | 冷却塔 | 냉각탑 | 冷却塔 | Torre de enfriamiento [CTI/ASHRAE]
VRF | Hệ thống lưu lượng môi chất biến đổi | 变冷媒流量系统 | 가변냉매유량 | 可変冷媒流量システム | VRF [AHRI 1230]
Heat Pump | Bơm nhiệt | 热泵 | 히트 펌프 | ヒートポンプ | Bomba de calor [ASHRAE/IEA]
Compressor | Máy nén | 压缩机 | 압축기 | 圧縮機 | Compresor [ASHRAE Refrig.2022]
Evaporator | Dàn bay hơi | 蒸发器 | 증발기 | 蒸発器 | Evaporador [ASHRAE Refrig.2022]
Condenser | Dàn ngưng tụ | 冷凝器 | 응축기 | 凝縮器 | Condensador [ASHRAE Refrig.2022]
Chilled Water (CHW) | Nước lạnh | 冷冻水 | 냉수 | 冷水 | Agua fría [ASHRAE/AHRI]
Condenser Water (CW) | Nước giải nhiệt | 冷却水 | 냉각수 | 冷却水 | Agua de condensación [ASHRAE/AHRI]
GWP | Tiềm năng nóng lên toàn cầu | 全球增暖潜能值 | 지구온난화지수 | 地球温暖化係数 | GWP [IPCC]

### C6. Heat Transfer / Truyền nhiệt
Overall HTC (U-value) | Hệ số truyền nhiệt tổng | 总传热系数 | 총 열관류율 | 総合熱貫流率 | U-value [ASHRAE Fund./ISO 6946]
Thermal Resistance (R-value) | Nhiệt trở | 热阻 | 열저항 | 熱抵抗 | R-value [ASHRAE 90.1/ISO 6946]
LMTD | Hiệu nhiệt độ trung bình logarit | 对数平均温差 | 대수평균온도차 | 対数平均温度差 | LMTD [ASHRAE Fund.2021]
Thermal Bridging | Cầu nhiệt | 热桥 | 열교 | 熱橋 | Puente térmico [ISO 10211]
SHGC | Hệ số thu nhiệt bức xạ mặt trời | 太阳能得热系数 | 태양열취득계수 | 日射取得率 | SHGC [ASHRAE 90.1]

### C7. Equipment / Thiết bị HVAC
Energy Recovery Ventilator (ERV) | Thiết bị thu hồi năng lượng | 能量回收新风机 | 에너지회수환기장치 | 全熱交換型換気装置 | ERV [ASHRAE 84/AHRI 1060]
Heat Recovery Ventilator (HRV) | Thiết bị thu hồi nhiệt | 热回收新风机 | 현열회수환기장치 | 顕熱交換型換気装置 | HRV [ASHRAE 84/AHRI 1060]
DOAS | Hệ thống xử lý khí ngoài độc lập | 新风处理机组 | 전외기 처리 시스템 | 全外気処理システム | DOAS [ASHRAE 62.1/AHRI 920]
VSD / VFD | Biến tần tốc độ | 变频器 | 가변속도장치 | インバーター | VFD [IEC 61800]
DX System | Hệ thống giãn nở trực tiếp | 直接膨胀式系统 | 직접팽창 시스템 | 直膨式システム | DX System [ASHRAE/AHRI]

### C8. Controls & BAS / Điều khiển & Tự động hóa
Building Automation System (BAS) | Hệ thống tự động hóa tòa nhà | 楼宇自控系统 | 빌딩 자동화 시스템 | ビル自動化システム | BAS [ISO 16484]
Building Management System (BMS) | Hệ thống quản lý tòa nhà | 楼宇管理系统 | 빌딩 관리 시스템 | ビル管理システム | BMS [ISO 16484]
BACnet Protocol | Giao thức BACnet | BACnet通信协议 | BACnet 프로토콜 | BACnetプロトコル | BACnet [ASHRAE 135]
PID Control | Điều khiển PID | PID控制 | PID 제어 | PID制御 | PID [ISA-5.1]
Setpoint | Điểm đặt | 设定值 | 설정값 | 設定値 | Setpoint [ASHRAE]
Actuator | Bộ truyền động | 执行器 | 액추에이터 | アクチュエーター | Actuator [ASHRAE]
Fault Detection & Diagnostics (FDD) | Phát hiện và chẩn đoán lỗi | 故障检测与诊断 | 결함 감지 및 진단 | 故障検知診断 | FDD [ASHRAE Guideline 36]
Commissioning (Cx) | Nghiệm thu vận hành | 调试/验收 | 시운전 | コミッショニング | Cx [ASHRAE Guideline 0]
TAB | Kiểm tra, điều chỉnh và cân bằng | 系统测试、调整与平衡 | 시험·조정·밸런싱 | 試験・調整・バランシング | TAB [ASHRAE Guideline 12]

### C9. Fire & Life Safety / PCCC & An toàn
Fire Rating | Cấp chịu lửa | 耐火等级 | 내화 등급 | 耐火等級 | Clasificación resistencia al fuego [UL 555/NFPA 90A]
Fusible Link | Mắt cầu chì nhiệt | 易熔合金片 | 용융 링크 | 温度ヒューズ | Enlace fusible [UL 33/NFPA 90A]
Smoke Control System | Hệ thống kiểm soát khói | 防排烟系统 | 연기제어 시스템 | 防煙・排煙システム | Sistema de humos [NFPA 92]
Stairwell Pressurization | Tăng áp thang bộ thoát hiểm | 疏散楼梯间加压 | 계단실 가압 | 避難階段加圧 | Presurización escalera [NFPA 92/EN 12101-6]
Smoke Extraction | Hút khói | 排烟 | 연기 배출 | 排煙 | Extracción de humos [NFPA 92/EN 12101]
Intumescent Seal | Vật liệu chèn bịt trương nở | 膨胀型防火封堵 | 팽창형 방화 씰 | 耐火膨張シール | Sellado intumescente [UL 2079/EN 1366]

### C10. Acoustics / Âm thanh
Noise Criterion (NC) | Tiêu chí ồn NC | 噪声评价曲线 | 소음기준 NC | NC曲線 | NC [ASHRAE HVAC Apps]
Room Criterion (RC) | Tiêu chí phòng RC | 房间噪声评价 | 실내기준 RC | 室内騒音基準 | RC [ASHRAE HVAC Apps]
Sound Power Level (Lw) | Mức công suất âm | 声功率级 | 음향파워레벨 | 音響パワーレベル | Lw [ISO 3741/AMCA 300]
Insertion Loss (IL) | Mức suy giảm âm | 插入损失 | 삽입손실 | 挿入損失 | IL [ASHRAE/ASTM E477]
Silencer / Attenuator | Bộ giảm âm | 消声器 | 소음기 | サイレンサー | Silenciador [ASHRAE/AMCA 300]
Vibration Isolation | Chống rung | 隔振 | 진동 격리 | 防振 | Aislamiento [ASHRAE/ISO 10816]
Breakout Noise | Ồn rò qua vách ống gió | 串声 | 관벽 방사 소음 | ブレークアウトノイズ | Ruido de irradiación [ASHRAE Ch.48]

---

## SECTION D — STARDUCT PRODUCT TERMINOLOGY

### D1. Product Terms (VI ↔ EN ↔ ZH ↔ KO ↔ JP)
| VI | EN | ZH | KO | JP |
|---|---|---|---|---|
| Van ngăn cháy cách nhiệt | Insulated Fire Damper (EI type) | EI防火阀 | 단열형 EI 방화댐퍼 | EI防火ダンパー |
| Van ngăn cháy | Fire Damper | 防火阀 | 방화댐퍼 | 防火ダンパー |
| Van ngăn khói | Smoke Damper | 防烟阀 | 연기댐퍼 | 防煙ダンパー |
| Van ngăn cháy-khói kết hợp | Combination Fire/Smoke Damper | 防火防烟阀 | 복합 방화/연기 댐퍼 | 防火防煙ダンパー |
| Van điều chỉnh lưu lượng | Volume Control Damper (VCD) | 风量调节阀 | VCD 댐퍼 | 風量調節ダンパー |
| Van một chiều | Backdraft Damper | 止回风阀 | 역풍방지 댐퍼 | 逆流防止ダンパー |
| Miệng thổi khe dài | Slot Diffuser (SLD) | 线型散流器 | 슬롯 디퓨저 | スロットディフューザー |
| Miệng khuếch tán | Ceiling Diffuser | 散流器 | 천장형 디퓨저 | シーリングディフューザー |
| Miệng lưới | Grille | 格栅 | 그릴 | グリル |
| Hộp VAV | VAV Box (SVAV-S) | 变风量末端 | VAV 박스 | VAVボックス |
| Bộ giảm âm | Silencer / Attenuator | 消声器 | 소음기 | サイレンサー |
| Lá chớp | Louver | 百叶窗 | 루버 | ルーバー |
| Cánh van | Damper Blades | 叶片 | 블레이드 | 羽根 |
| Bích liền thân van | Integral Flange | 整体法兰 | 일체형 플랜지 | 一体型フランジ |
| Bộ truyền động lò xo phản hồi | Spring-return actuator | 弹簧复位执行器 | 스프링 리턴 액추에이터 | スプリングリターンアクチュエータ |
| Điều khiển / Động cơ | Control / Actuator | 控制/执行器 | 제어 / 액추에이터 | 制御/アクチュエータ |
| Bông gốm cách nhiệt | Ceramic Fiber Insulation | 陶瓷纤维隔热棉 | 세라믹 섬유 단열재 | 断熱セラミックファイバー |
| Lớp chống cháy | Fireproof Layer | 防火层 | 방화층 | 耐火層 |
| Báo cáo thử nghiệm | Test Report | 检测报告 | 시험 성적서 | 試験報告書 |
| Mô-men xoắn | Torque | 扭矩 | 토크 | トルク |
| Điện áp danh định | Nominal voltage | 额定电压 | 정격 전압 | 定格電圧 |

### D2. STARDUCT Key Facts
- **Nhà sản xuất:** Ngôi Sao Châu Á JSC (NSCA) | Đan Phượng, Hà Nội, Việt Nam
- **Thương hiệu:** STARDUCT | Website: starduct.vn
- **Chứng nhận:** UL 555, UL 555S, FM, **AHRI 880** (duy nhất tại Việt Nam), AMCA member
- **Sản phẩm:** Grilles, diffusers, VAV boxes (SVAV-S), fire/smoke/volume dampers, louvers, silencers
- **Liên hệ kỹ thuật:** info@nsca.vn | Sales: sales@nsca.vn | Hotline: 0246.260.9999

---

## SECTION E — CONSULTATION PROTOCOL

### E1. Khi trả lời câu hỏi HVAC
1. Check Section A cho công thức liên quan → tính toán cụ thể với số liệu
2. Check Section B cho ký hiệu/đơn vị đúng
3. Check Section C cho thuật ngữ đúng theo ngôn ngữ reply
4. Nếu tham chiếu tiêu chuẩn → trích dẫn rõ ràng
5. Nếu không chắc → nói "Em cần xác minh lại" trước khi trả lời
6. Nếu cần thông tin hiện tại (tiêu chuẩn mới, sản phẩm mới) → dùng web_search

### E2. Không dịch
- Model codes: SAG600, DAG450, SKD600, SLD-A2S, SVAV-S, VCD, S-MFSD
- Standards: ASHRAE 70, UL 555, AMCA 500-D, TCVN 5687, EN 1366
- Certification bodies: Intertek, UL, AHRI, AMCA
- Units: Pa, kPa, m³/h, CFM, L/s, °C, °F, NC, dB, rpm, kW, TR
