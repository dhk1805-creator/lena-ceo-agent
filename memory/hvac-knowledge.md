# HVAC Knowledge Base — STARDUCT / NSCA

## TIEU CHUAN & TO CHUC (Standards Organizations)

### Websites tra cuu tieu chuan:
| To chuc | Website | Lien quan STARDUCT |
|---------|---------|-------------------|
| ASHRAE | https://www.ashrae.org | Tiêu chuẩn thiết kế HVAC: Standard 55 (thermal comfort), 62.1 (ventilation), 70 (air terminal testing), 90.1 (energy), 130 (VAV testing) |
| AMCA | https://www.amca.org | Tiêu chuẩn quạt & damper: 500-D (damper testing), 500-L (louver testing). NSCA là thành viên AMCA International |
| SMACNA | https://www.smacna.org | Tiêu chuẩn ống gió & thi công: Duct Construction Standards, HVAC Air Duct Leakage Test Manual |
| AHRI | https://www.ahrinet.org | Chứng nhận sản phẩm: AHRI 880 (air terminal noise) — STARDUCT là nhà sản xuất DUY NHẤT tại VN có AHRI 880 |
| UL | https://www.ul.com | An toàn phòng cháy: UL 555 (fire damper), UL 555S (smoke damper) |
| FM Global | https://www.fmglobal.com | Bảo hiểm & an toàn: FM Approved fire dampers |
| ISO | https://www.iso.org/home.html | Tiêu chuẩn quốc tế: ISO 5801 (fan testing), ISO 14001 (env management), ISO 9001 (quality) |
| European Standards | https://european-standards.com | Tiêu chuẩn châu Âu (EN): EN 1366-2, EN 15650, EN 13779 (ventilation), EN 12237 (ductwork) |
| Standards Australia | https://www.standards.org.au | AS1530.4 (fire resistance test), AS1682.1 (fire damper) |
| BSI | https://www.bsigroup.com | BS EN 1366-2 (fire damper test), BS EN 15650 (damper classification) |
| WHO | https://www.who.int | Hướng dẫn IAQ (Indoor Air Quality), tiêu chuẩn không khí sạch, ventilation guidelines cho phòng dịch |
| LEED / Green Building | https://www.leedenvironmental.com | LEED certification, green building, sustainable HVAC design — liên quan IEQ credits, ventilation, energy efficiency |
| Wheels (Energy Recovery) | https://www.wheels.com/public/ | Enthalpy wheels, energy recovery wheels — công nghệ thu hồi năng lượng cho hệ thống HVAC, total energy recovery |

### San pham STARDUCT & tieu chuan ap dung:
| San pham | Tieu chuan chinh | Tieu chuan test |
|----------|-----------------|-----------------|
| Fire Damper (Van ngan chay) | AS1530.4, BS EN 1366-2, UL 555 | Fire resistance 1-4 hours, E/EI classification |
| Smoke Damper | UL 555S, BS EN 1366-2 | Air leakage at ambient & 250°C |
| Air Grille & Diffuser (Cua gio) | ASHRAE 70, AHRI 880 | Throw, NC level, pressure drop |
| VAV Box | ASHRAE 130, AHRI 880 | Discharge sound power, control accuracy |
| VCD (Volume Control Damper) | AMCA 500-D, SMACNA | Torque, leakage class I/II/III |
| Cable Tray (Thang mang cap) | IEC 61537, NEMA VE1 | Load capacity, corrosion resistance |
| Louver | AMCA 500-L | Water penetration, free area, pressure drop |

## CONG THUC HVAC (73 formulas)

### 1. KHONG KHI & TAM LY AM (Air & Psychrometrics)
| # | Ten | Cong thuc | Bien | Don vi |
|---|-----|-----------|------|--------|
| 1 | Luu luong khoi khi kho | m_da = Q2 / [1.005 × (T1-T3)] | Q2=heat(kW), T1,T3=temp(°C) | kg/s |
| 2 | Ti so am (Humidity Ratio) | W = 0.29198 × Pv / (P-Pv) | Pv=vapor pressure, P=total pressure | kg/kg dry air |
| 3 | Do am tuong doi | φ = Pv / Pvs(Tdb) × 100% | Pv=vapor press, Pvs=saturated | % |
| 4 | Enthalpy khi am | h = 1.005×T + W×(2500+1.887×T) | T=dry bulb(°C), W=humidity ratio | kJ/kg dry air |
| 5 | Diem suong (Dew Point) | Tu bieu do tam ly am | — | °C |
| 6 | The tich rieng | v = 0.287042×(T+273.15)×(1+1.88715W)/P | T=°C, W=hum.ratio, P=kPa | m³/kg dry air |
| 7 | Mat do khi am | ρ = 1/v | v=specific volume | kg/m³ |

### 2. NHIET & TAI LANH (Heat & Load)
| # | Ten | Cong thuc | Bien | Don vi |
|---|-----|-----------|------|--------|
| 9 | Nhiet hien (Sensible) | Qs = 1.23 × CFM × ΔT | CFM=airflow, ΔT=temp diff | Btu/hr |
| 10 | Nhiet an (Latent) | Ql = 0.44 × CFM × ΔW | CFM=airflow, ΔW=humidity diff | Btu/hr |
| 11 | Tong nhiet | Qt = Qs + Ql | Qs=sensible, Ql=latent | Btu/hr |
| 12 | Luu luong khi | CFM = Q1 / [1.23 × ΔT] | Q1=heat load | CFM |
| 13 | Tai lanh (Ton) | TR = Qt / 12000 | Qt=total heat(Btu/hr) | TR |
| 15 | Nhiet theo mass flow | Q = ṁ × Cp × (T1-T2) | ṁ=mass flow, Cp=1.005 | kW |
| 16 | He so nhiet hien (SHF) | SHF = Qs / Qt | Qs=sensible, Qt=total | — |

### 3. LUU LUONG KHI & ONG GIO (Airflow & Duct)
| # | Ten VI | Ten EN | Cong thuc | Bien | Don vi |
|---|--------|--------|-----------|------|--------|
| 19 | Van toc khong khi | Air Velocity | V = Q / A | Q=airflow, A=area | m/s |
| 20 | Luu luong tu van toc | Flow from Velocity | Q = V × A | V=velocity, A=area | CFM |
| 21 | Dien tich ong gio | Duct Area | A = Q / V | Q=airflow, V=velocity | m² |
| 22 | Duong kinh tuong duong (tron) | Equivalent Diameter (Round) | D = √(4A/π) | A=cross-section area | mm |
| 23 | So Reynolds | Reynolds Number | Re = ρVD / μ | ρ=density, V=vel, D=dia, μ=viscosity | — |
| 24 | He so ma sat (Haaland) | Friction Factor | 1/√f = -1.8 log[6.9/Re + (ε/D/3.7)^1.11] | Re=Reynolds, ε=roughness | — |
| 25 | Ton that ma sat ong | Duct Friction Loss | ΔP = f × (L/D) × (ρV²/2) | f=friction, L=length, D=dia | Pa |
| 26 | Ap suat dong | Velocity Pressure | VP = ρV²/2 × (1/g) | ρ=density, V=velocity | in.wg |
| 27 | Ap suat toc do | Velocity Pressure (Pa) | VP = ρV²/2 | ρ=density, V=velocity | Pa |
| 28 | So lan thay doi khong khi/gio | Air Changes per Hour | ACH = CFM × 60 / Room Vol | CFM=airflow, Vol=room(ft³) | ACH |

### 4. TRUYEN NHIET (Heat Transfer)
| # | Ten | Cong thuc | Bien | Don vi |
|---|-----|-----------|------|--------|
| 29 | Truyen nhiet co ban | Q = U × A × ΔT | U=overall HTC, A=area | W |
| 30 | He so truyen nhiet tong | 1/U = 1/h1 + L/k + 1/h2 | h=conv coeff, k=conductivity | W/m²K |
| 31 | Dan nhiet (Conduction) | Q = k × A × ΔT / L | k=conductivity, L=thickness | W |
| 32 | Doi luu (Convection) | Q = h × A × (Ts-T∞) | h=heat transfer coeff | W |
| 33 | Buc xa (Radiation) | Q = ε×σ×A×(Ts⁴-Tsur⁴) | σ=5.67×10⁻⁸ W/m²K⁴ | W |
| 34 | LMTD | ΔTlm = (ΔT1-ΔT2)/ln(ΔT1/ΔT2) | ΔT1,ΔT2=terminal temp diff | °C |

### 5. CHU TRINH LANH (Refrigeration)
| # | Ten | Cong thuc | Bien | Don vi |
|---|-----|-----------|------|--------|
| 36 | Hieu ung lanh | RE = h1 - h4 | h1=evap outlet, h4=evap inlet | kJ/kg |
| 37 | Cong nen | W = h2 - h1 | h2=comp outlet, h1=comp inlet | kJ/kg |
| 39 | COP | COP = (h1-h4)/(h2-h1) | RE/compressor work | — |
| 40 | Luu luong moi chat | ṁ = Q1/(h1-h4) | Q1=cooling capacity | kg/s |

### 6. DINH LUAT QUAT & BOM (Fan & Pump Laws)
| # | Ten | Cong thuc | Giai thich |
|---|-----|-----------|------------|
| 42 | Affinity - Flow | Q1/Q2 = N1/N2 | Luu luong ty le bac 1 voi toc do |
| 43 | Affinity - Pressure | P1/P2 = (N1/N2)² | Ap suat ty le bac 2 |
| 44 | Affinity - Power | HP1/HP2 = (N1/N2)³ | Cong suat ty le bac 3 |
| 46 | Cong suat truc | BP = Q × ΔP / η | Q=flow, ΔP=pressure, η=efficiency |
| 47 | Cong suat quat (HP) | HP = CFM×ΔP(in.wg)/(6356×η) | — |

### 7. DIEN (Electrical for HVAC)
| # | Ten | Cong thuc | Don vi |
|---|-----|-----------|--------|
| 48 | Cong suat 1 pha | P = V × I × cosφ | W |
| 50 | Dong dien 3 pha | I = P / (√3 × VL × cosφ) | A |
| 51 | Cong suat bieu kien | S = √3 × VL × I | VA |
| 53 | He so cong suat | cosφ = P / S | — |

### 8. THONG GIO (Ventilation & IAQ)
| # | Ten | Cong thuc | Bien |
|---|-----|-----------|------|
| 55 | Gio ngoai (ASHRAE 62.1) | Q_OA = CFM_p × N_people | CFM_p = luu luong/nguoi |
| 57 | Hieu qua thong gio | Ev = (C_out-C_supply)/(C_room-C_supply) | C=CO₂ concentration |
| 58 | Can bang CO₂ | Q = G / (Cs-Ci) | G=CO₂ generation rate |

### 9. CUON LANH (Coil & Heat Exchanger)
| # | Ten | Cong thuc | Don vi |
|---|-----|-----------|--------|
| 59 | Truyen nhiet coil | Q = U × A × ΔTlm | W |
| 60 | Dien tich be mat | A = Q / (U × ΔTlm) | m² |
| 62 | Hieu suat canh tan nhiet | ηf = tanh(mL)/(mL) | — |

### 10. DUONG ONG (Pipe & Fluid)
| # | Ten | Cong thuc | Don vi |
|---|-----|-----------|--------|
| 63 | Darcy-Weisbach | hf = f×(L/D)×V²/(2g) | m |
| 64 | Ton that cot ap | ΔP = ρ × g × hf | Pa |

## DOI DON VI NHANH (Quick Conversions)
| Doi | Cong thuc |
|-----|-----------|
| 1 TR (Ton lanh) | = 12,000 Btu/hr = 3.517 kW |
| 1 kW | = 3,412 Btu/hr |
| 1 CFM | = 0.4719 L/s |
| °C → °F | T(°F) = 9/5×T(°C) + 32 |
| 1 in.wg | = 249.1 Pa |
| 1 kPa | = 4.015 in.wg |
| 1 kg/s | = 2.204 lb/s |
| 1 m/s | = 196.85 fpm |
| 1 Pa | = 0.004015 in.wg |

## BANG KY HIEU (Symbol Reference)
| Ky hieu | Y nghia | SI | IP |
|---------|---------|----|----|
| T | Nhiet do | °C | °F |
| P | Ap suat | Pa / kPa | psi / in.wg |
| Q | Nhiet / Luu luong | W, kW, m³/s | Btu/hr, CFM |
| W | Ti so am | kg/kg dry air | lb/lb dry air |
| φ | Do am tuong doi | % | % |
| h | Enthalpy | kJ/kg | Btu/lb |
| ρ | Mat do | kg/m³ | lb/ft³ |
| V | Van toc | m/s | fpm |
| U | He so truyen nhiet | W/m²K | Btu/hr·ft²·°F |
| k | Do dan nhiet | W/mK | Btu/hr·ft·°F |
| Re | So Reynolds | — | — |
| COP | He so hieu suat | — | — |
| TR | Ton lanh | 3.517 kW | 12,000 Btu/hr |
| CFM | Cubic Feet/Min | 0.4719 L/s | ft³/min |
| ACH | Lan thay khi/gio | /hr | /hr |
| SHF | He so nhiet hien | — | — |
| ΔT | Hieu nhiet do | K or °C | °F |
| ΔP | Hieu ap suat | Pa | in.wg |
| ṁ | Luu luong khoi | kg/s | lb/hr |
| Cp | Nhiet dung rieng | kJ/kg·K | Btu/lb·°F |

## THUAT NGU SAI — TUYET DOI KHONG DUNG
Khi tra loi cau hoi HVAC, KHONG tu dich hoac dung cac cum tu SAI sau:
| ❌ SAI | ✅ DUNG | EN |
|--------|--------|-----|
| Khang cu ong | Ton that ma sat ong | Duct Friction Loss |
| He so khang cu | He so ma sat | Friction Factor |
| Ap luc dong | Ap suat dong / Ap suat toc do | Velocity Pressure |
| Luu luong khong khi | Luu luong khi / Van toc khong khi | Airflow / Air Velocity |
| Nhiet do diem nuoc | Nhiet do diem suong | Dew Point Temperature |
| Do nong | Nhiet do | Temperature |

**NGUYEN TAC:** Khi khong chac thuat ngu VI → dung TEN TIENG ANH goc. Tot hon la dung EN chinh xac con hon dich sai sang VI.

## THUAT NGU HVAC - 6 NGON NGU
| VI | EN | ZH | JA | KO | ES |
|----|----|----|----|----|----|
| Van ngan chay | Fire Damper | 防火阀 | 防火ダンパー | 방화 댐퍼 | Compuerta cortafuego |
| Van ngan chay cach nhiet | Insulated Fire Damper | 防火调节阀 | 断熱防火ダンパー | 단열 방화 댐퍼 | Compuerta cortafuego aislada |
| Van ngan khoi | Smoke Damper | 排烟阀 | 排煙ダンパー | 방연 댐퍼 | Compuerta de humo |
| Van dieu chinh | Volume Control Damper (VCD) | 风量调节阀 | 風量調節ダンパー | 풍량조절댐퍼 | Compuerta reguladora |
| Cua gio | Air Grille | 风口 | エアグリル | 공기 그릴 | Rejilla de aire |
| Mieng gio khuech tan | Diffuser | 散流器 | ディフューザー | 디퓨저 | Difusor |
| Hop dieu hoa luu luong | VAV Box | 变风量末端 | VAVユニット | VAV 박스 | Caja VAV |
| Thang mang cap | Cable Tray | 电缆桥架 | ケーブルトレイ | 케이블트레이 | Bandeja portacables |
| Nan sot trung | Egg Crate Grille | 格栅风口 | 卵格子グリル | 에그크레이트 그릴 | Rejilla tipo huevera |
| Cua gio tuyen tinh | Linear Slot Diffuser | 条缝风口 | リニアスロットディフューザー | 리니어 슬롯 디퓨저 | Difusor lineal |
| Luoi chan mua | Louver | 百叶窗 | ルーバー | 루버 | Persiana |
| Ong gio | Duct | 风管 | ダクト | 덕트 | Conducto |
| Quat | Fan | 风机 | ファン | 팬 | Ventilador |
| May nen | Compressor | 压缩机 | コンプレッサー | 압축기 | Compresor |
| Dan bay hoi | Evaporator | 蒸发器 | 蒸発器 | 증발기 | Evaporador |
| Dan ngung tu | Condenser | 冷凝器 | 凝縮器 | 응축기 | Condensador |
| Chiller | Chiller | 冷水机组 | チラー | 칠러 | Enfriadora |
| AHU (Air Handling Unit) | AHU | 空气处理机组 | 空調機 | 공조기 | UTA |
| FCU (Fan Coil Unit) | FCU | 风机盘管 | ファンコイルユニット | 팬코일유닛 | Fan coil |
| BMS | Building Management System | 楼宇自控系统 | ビル管理システム | 빌딩관리시스템 | Sistema de gestión |
| Nhiet do diem suong | Dew Point Temperature | 露点温度 | 露点温度 | 이슬점 온도 | Temperatura de rocío |
| Do am tuong doi | Relative Humidity | 相对湿度 | 相対湿度 | 상대습도 | Humedad relativa |
| Tai lanh | Cooling Load | 冷负荷 | 冷房負荷 | 냉방부하 | Carga de refrigeración |
| He so nhiet hien | Sensible Heat Factor | 显热比 | 顕熱比 | 현열비 | Factor de calor sensible |
| Luu luong gio | Airflow Rate | 风量 | 風量 | 풍량 | Caudal de aire |
| Ap suat tinh | Static Pressure | 静压 | 静圧 | 정압 | Presión estática |

## TIEU CHUAN & QUY CHUAN VIET NAM (PCCC & Xay dung)

### Quy chuan bat buoc:
| Van ban | Link | Noi dung |
|---------|------|----------|
| QCVN 06:2022/BXD | https://moc.gov.vn/Images/editor/files/Quy%20Chu%E1%BA%A9n/QCVN%2006-2022.pdf | Quy chuan ky thuat quoc gia ve An toan chay cho nha va cong trinh. Ban hanh theo Thong tu 06/2022/TT-BXD, co hieu luc 16/01/2023 |
| Thong tu 06/2022/TT-BXD | https://chinhphu.vn/?pageid=27160&docid=207059&classid=1 | Thong tu ban hanh QCVN 06:2022/BXD — van ban phap ly chinh thuc |
| TCVN Portal | https://tcvn.gov.vn | Tong cuc Tieu chuan Do luong Chat luong — tra cuu tat ca tieu chuan TCVN |
| VFRA (Hiep hoi PCCC VN) | https://vfra.org/uploads/up/root/file/2022/12/17/00/39/65_1671190762_9743.pdf | Tai lieu tham khao PCCC tu Hiep hoi Phong chay Chua chay Viet Nam |

### QCVN 06:2022/BXD — Diem chinh lien quan STARDUCT:
**Phan loai chiu lua van ngan chay (Fire Damper EI rating):**
- **EI 30**: Chiu lua 30 phut — cong trinh nguy hiem chay thap
- **EI 60**: Chiu lua 60 phut — cong trinh nguy hiem chay trung binh
- **EI 90**: Chiu lua 90 phut — cong trinh nguy hiem chay cao
- **EI 120**: Chiu lua 120 phut — cong trinh dac biet

**Yeu cau:**
- Van ngan chay tu dong dong khi nhiet do tang den muc dinh san (thuong 72°C fusible link)
- Van ngan khoi kiem soat va ngan chan su lan toa khoi doc trong he thong thong gio
- Vi tri lap dat va thoi gian chiu lua phu thuoc vao cap do nguy hiem chay cua cong trinh
- STARDUCT fire damper dat **EI 180** (vuot tieu chuan cao nhat EI 120) theo AS1530.4 va BS EN 1366-2

### TCVN lien quan san pham STARDUCT:
| TCVN | Noi dung |
|------|----------|
| TCVN 5738 | He thong bao chay tu dong — Yeu cau ky thuat |
| TCVN 2622 | Phong chay cho nha va cong trinh — Yeu cau thiet ke |
| TCVN 6160 | Phong chay — Nha cao tang — Yeu cau thiet ke |
| TCVN 9311 | Thu nghiem chiu lua — Cac bo phan cua toa nha |
| QCVN 06:2022/BXD | An toan chay cho nha va cong trinh (thay the QCVN 06:2010) |

## NGUON DATA SOURCE
- Cong thuc: Google Sheet `15GLw7PyJ9DTmfQfIzM9nhEsbJVpsywYDaPuj-WB7UP0` (gid=1435957101)
- Tieu chuan VN: QCVN 06:2022/BXD, TCVN Portal, VFRA
- Cap nhat: 05/2026
