export type Company = {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  cap: "Small Cap" | "Mid Cap" | "Large Cap";
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
  pe: number;
  eps: number;
  weekHigh52: number;
  weekLow52: number;
  volume: string;
  avgVolume: string;
  dividend: number;
  beta: number;
  debtToEquity: number;
  roe: number;
  roce: number;
  promoterHolding: number;
  overallScore: number;
  confidenceScore: number;
};

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  date: string;
  sentiment: "positive" | "negative" | "neutral";
  summary: string;
  url: string;
};

export type QuarterlyData = {
  quarter: string;
  revenue: number;
  netProfit: number;
  ebitda: number;
  eps: number;
  operatingMargin: number;
};

export type ManagementGuidance = {
  quarter: string;
  said: string;
  delivered: string;
  deviation: number;
  metric: string;
  pattern: "consistent" | "overpromise" | "underpromise" | "erratic";
};

export type AgentMessage = {
  agent: "Agent Alpha" | "Agent Beta" | "Agent Gamma" | "Monitor";
  message: string;
  timestamp: string;
  type: "analysis" | "challenge" | "agreement" | "verdict" | "hallucination_flag";
};

export type ScoreCard = {
  dimension: string;
  score: number;
  maxScore: number;
  confidence: number;
  evidence: string;
  source: string;
  reasoning: AgentMessage[];
};

export type CandlestickPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const companies: Company[] = [
  {
    id: "1", name: "Deepak Nitrite Ltd", ticker: "DEEPAKNTR", sector: "Chemicals",
    cap: "Mid Cap", price: 2145.30, change: 32.50, changePercent: 1.54,
    marketCap: "₹29,280 Cr", pe: 38.2, eps: 56.16, weekHigh52: 2650, weekLow52: 1780,
    volume: "4.2L", avgVolume: "3.8L", dividend: 0.65, beta: 1.12,
    debtToEquity: 0.08, roe: 18.5, roce: 24.3, promoterHolding: 45.41,
    overallScore: 78, confidenceScore: 82,
  },
  {
    id: "2", name: "Aarti Industries Ltd", ticker: "AARTIIND", sector: "Chemicals",
    cap: "Mid Cap", price: 582.40, change: -8.70, changePercent: -1.47,
    marketCap: "₹21,100 Cr", pe: 42.5, eps: 13.70, weekHigh52: 725, weekLow52: 480,
    volume: "6.1L", avgVolume: "5.5L", dividend: 0.52, beta: 0.95,
    debtToEquity: 0.35, roe: 12.8, roce: 15.6, promoterHolding: 43.68,
    overallScore: 65, confidenceScore: 75,
  },
  {
    id: "3", name: "Navin Fluorine International", ticker: "NAVINFLUOR", sector: "Chemicals",
    cap: "Mid Cap", price: 3520.80, change: 45.20, changePercent: 1.30,
    marketCap: "₹17,450 Cr", pe: 55.3, eps: 63.67, weekHigh52: 4200, weekLow52: 2900,
    volume: "1.8L", avgVolume: "2.1L", dividend: 0.28, beta: 1.25,
    debtToEquity: 0.12, roe: 15.2, roce: 19.8, promoterHolding: 29.35,
    overallScore: 72, confidenceScore: 79,
  },
  {
    id: "4", name: "Clean Science & Technology", ticker: "CLEAN", sector: "Chemicals",
    cap: "Mid Cap", price: 1380.50, change: 18.30, changePercent: 1.34,
    marketCap: "₹14,620 Cr", pe: 62.1, eps: 22.23, weekHigh52: 1850, weekLow52: 1100,
    volume: "2.3L", avgVolume: "1.9L", dividend: 0.35, beta: 0.88,
    debtToEquity: 0.02, roe: 22.1, roce: 28.5, promoterHolding: 52.33,
    overallScore: 81, confidenceScore: 86,
  },
  {
    id: "5", name: "Vinati Organics Ltd", ticker: "VINATIORGA", sector: "Chemicals",
    cap: "Mid Cap", price: 1820.60, change: -12.40, changePercent: -0.68,
    marketCap: "₹18,700 Cr", pe: 48.7, eps: 37.38, weekHigh52: 2200, weekLow52: 1550,
    volume: "1.5L", avgVolume: "1.8L", dividend: 0.42, beta: 0.92,
    debtToEquity: 0.05, roe: 16.8, roce: 21.4, promoterHolding: 74.04,
    overallScore: 76, confidenceScore: 80,
  },
  {
    id: "6", name: "Fine Organic Industries", ticker: "FINEORG", sector: "Chemicals",
    cap: "Small Cap", price: 4650.20, change: 72.80, changePercent: 1.59,
    marketCap: "₹14,250 Cr", pe: 52.8, eps: 88.07, weekHigh52: 5800, weekLow52: 3900,
    volume: "0.8L", avgVolume: "0.9L", dividend: 0.55, beta: 0.78,
    debtToEquity: 0.01, roe: 20.3, roce: 26.7, promoterHolding: 75.00,
    overallScore: 83, confidenceScore: 88,
  },
  {
    id: "7", name: "Alkyl Amines Chemicals", ticker: "ALKYLAMINE", sector: "Chemicals",
    cap: "Small Cap", price: 1950.40, change: -25.60, changePercent: -1.30,
    marketCap: "₹9,980 Cr", pe: 45.2, eps: 43.15, weekHigh52: 2500, weekLow52: 1650,
    volume: "1.2L", avgVolume: "1.0L", dividend: 0.38, beta: 1.05,
    debtToEquity: 0.15, roe: 14.5, roce: 18.9, promoterHolding: 60.22,
    overallScore: 70, confidenceScore: 74,
  },
  {
    id: "8", name: "Galaxy Surfactants Ltd", ticker: "GALAXYSURF", sector: "Chemicals",
    cap: "Small Cap", price: 2780.90, change: 15.30, changePercent: 0.55,
    marketCap: "₹9,850 Cr", pe: 35.6, eps: 78.12, weekHigh52: 3200, weekLow52: 2400,
    volume: "0.6L", avgVolume: "0.7L", dividend: 1.08, beta: 0.65,
    debtToEquity: 0.10, roe: 17.2, roce: 22.8, promoterHolding: 71.48,
    overallScore: 77, confidenceScore: 81,
  },
];

export const getCompanyNews = (companyId: string): NewsItem[] => [
  {
    id: "n1", title: `${companies.find(c=>c.id===companyId)?.name} reports strong Q3 results, beats estimates`,
    source: "Economic Times", date: "2026-04-10",
    sentiment: "positive",
    summary: "Company reported revenue growth of 18% YoY driven by robust demand in specialty chemicals segment. EBITDA margins expanded by 200bps.",
    url: "#",
  },
  {
    id: "n2", title: "Chemical sector faces headwinds from rising crude oil prices",
    source: "Business Standard", date: "2026-04-09",
    sentiment: "negative",
    summary: "Rising crude oil prices may impact raw material costs for chemical companies in Q4. Analysts expect margin compression of 100-150bps.",
    url: "#",
  },
  {
    id: "n3", title: "Government announces PLI scheme extension for specialty chemicals",
    source: "LiveMint", date: "2026-04-08",
    sentiment: "positive",
    summary: "The Union Government has extended the PLI scheme for specialty chemicals by 2 more years, providing additional incentives worth ₹3,000 Cr.",
    url: "#",
  },
  {
    id: "n4", title: `Promoter increases stake in ${companies.find(c=>c.id===companyId)?.name}`,
    source: "MoneyControl", date: "2026-04-07",
    sentiment: "positive",
    summary: "Promoter entity acquired 0.5% additional stake through open market purchases, signaling confidence in the business outlook.",
    url: "#",
  },
  {
    id: "n5", title: "RBI maintains repo rate; chemical stocks remain stable",
    source: "NDTV Profit", date: "2026-04-06",
    sentiment: "neutral",
    summary: "The RBI kept the repo rate unchanged at 6.25%. Chemical stocks showed muted reaction as the decision was largely expected.",
    url: "#",
  },
];

export const quarterlyData: QuarterlyData[] = [
  { quarter: "Q1 FY25", revenue: 1850, netProfit: 285, ebitda: 420, eps: 14.2, operatingMargin: 22.7 },
  { quarter: "Q2 FY25", revenue: 1920, netProfit: 310, ebitda: 455, eps: 15.5, operatingMargin: 23.7 },
  { quarter: "Q3 FY25", revenue: 2050, netProfit: 340, ebitda: 498, eps: 17.0, operatingMargin: 24.3 },
  { quarter: "Q4 FY25", revenue: 1780, netProfit: 245, ebitda: 378, eps: 12.3, operatingMargin: 21.2 },
  { quarter: "Q1 FY26", revenue: 2120, netProfit: 365, ebitda: 530, eps: 18.3, operatingMargin: 25.0 },
  { quarter: "Q2 FY26", revenue: 2250, netProfit: 398, ebitda: 572, eps: 19.9, operatingMargin: 25.4 },
  { quarter: "Q3 FY26", revenue: 2380, netProfit: 425, ebitda: 610, eps: 21.3, operatingMargin: 25.6 },
];

export const managementGuidance: ManagementGuidance[] = [
  { quarter: "Q4 FY25", said: "Revenue growth of 15-18% YoY", delivered: "Revenue declined 13.2% QoQ due to tax provisioning", deviation: -8.5, metric: "Revenue Growth", pattern: "overpromise" },
  { quarter: "Q1 FY26", said: "EBITDA margin expansion to 25%+", delivered: "EBITDA margin at 25.0%", deviation: 0, metric: "EBITDA Margin", pattern: "consistent" },
  { quarter: "Q2 FY26", said: "Capex of ₹200 Cr for new plant", delivered: "Capex of ₹180 Cr, delayed by 1 quarter", deviation: -10, metric: "Capex", pattern: "overpromise" },
  { quarter: "Q3 FY26", said: "Export revenue to reach 40% of total", delivered: "Export revenue at 38.5% of total", deviation: -3.75, metric: "Export Share", pattern: "underpromise" },
  { quarter: "Q1 FY26", said: "New product launches in Q2", delivered: "2 of 3 products launched on time", deviation: -33, metric: "Product Launches", pattern: "overpromise" },
  { quarter: "Q2 FY26", said: "Debt reduction by ₹50 Cr", delivered: "Debt reduced by ₹65 Cr", deviation: 30, metric: "Debt Reduction", pattern: "underpromise" },
];

export const scoreCards: ScoreCard[] = [
  {
    dimension: "Industry Position", score: 8.2, maxScore: 10, confidence: 85,
    evidence: "Market leader in specialty chemicals with 22% market share in key product segments. Strong distribution network across 45+ countries.",
    source: "Annual Report FY25, p.12 | BSE Filing dated 15-Mar-2026",
    reasoning: [
      { agent: "Agent Alpha", message: "Based on CRISIL industry report, the company holds #2 position in ATBS globally with 22% market share. Revenue CAGR of 18% over 5 years outpaces industry average of 12%.", timestamp: "10:23:15", type: "analysis" },
      { agent: "Agent Beta", message: "I challenge the market share figure. The CRISIL report is from 2024. Recent Chinese capacity additions may have eroded share by 2-3%.", timestamp: "10:23:45", type: "challenge" },
      { agent: "Agent Gamma", message: "Agree with Beta's concern but Q3 FY26 earnings call (timestamp 23:45) confirmed maintained market share through value-added products pivot.", timestamp: "10:24:12", type: "agreement" },
      { agent: "Monitor", message: "Alpha's initial claim verified through Q3 transcript. Beta's concern valid but addressed by management. Score: 8.2/10. Confidence: 85%.", timestamp: "10:24:30", type: "verdict" },
    ],
  },
  {
    dimension: "Financial Quality", score: 7.8, maxScore: 10, confidence: 90,
    evidence: "Consistent ROE above 18% for 5 consecutive years. Debt-to-equity at 0.08x, one of the lowest in the sector. Operating cash flow conversion at 92%.",
    source: "Quarterly Results BSE Filing Q3 FY26 | Annual Report FY25, p.45-48",
    reasoning: [
      { agent: "Agent Alpha", message: "Financial metrics are robust. ROE of 18.5%, ROCE of 24.3%. Free cash flow yield of 3.2% is healthy for a growth company.", timestamp: "10:25:00", type: "analysis" },
      { agent: "Agent Beta", message: "Q4 FY25 showed revenue decline of 13.2% QoQ. This is concerning and needs context.", timestamp: "10:25:30", type: "challenge" },
      { agent: "Agent Alpha", message: "The Q4 decline is attributable to tax provisioning impact. Management addressed this in Q4 earnings call (timestamp 15:32). This is a short-term accounting adjustment, not operational deterioration.", timestamp: "10:26:00", type: "analysis" },
      { agent: "Monitor", message: "Q4 dip correctly identified as short-term tax provisioning impact. Not indicative of structural weakness. Adjusting score to reflect this context. Score: 7.8/10. Confidence: 90%.", timestamp: "10:26:30", type: "verdict" },
    ],
  },
  {
    dimension: "Management Credibility", score: 6.5, maxScore: 10, confidence: 72,
    evidence: "Management has met guidance on 6 of 10 metrics over 4 quarters. Notable misses on capex timeline and product launch commitments. Promoter holding stable at 45.41%.",
    source: "Earnings Call Transcripts Q4 FY25 - Q3 FY26 | BSE Shareholding Pattern",
    reasoning: [
      { agent: "Agent Alpha", message: "Promoter holding stable. No pledging of shares. Consistent dividend payout ratio of 25-30%.", timestamp: "10:27:00", type: "analysis" },
      { agent: "Agent Gamma", message: "However, management overpromised on capex (₹200 Cr guided vs ₹180 Cr delivered) and product launches (2 of 3 on time). Pattern suggests optimistic guidance.", timestamp: "10:27:30", type: "challenge" },
      { agent: "Agent Beta", message: "Agree. Also found that MD's tone in Q2 call showed hesitation markers when asked about margin sustainability. Confidence in forward guidance should be discounted.", timestamp: "10:28:00", type: "agreement" },
      { agent: "Monitor", message: "Valid concerns from Gamma and Beta. Management credibility score adjusted downward. Overpromise pattern detected across 2 quarters. Score: 6.5/10. Confidence: 72%.", timestamp: "10:28:30", type: "verdict" },
    ],
  },
  {
    dimension: "Risk Identification", score: 7.0, maxScore: 10, confidence: 78,
    evidence: "Key risks: crude oil price sensitivity (40% raw material linked), customer concentration (top 5 clients = 35% revenue), regulatory changes in chemical sector, forex exposure on 38.5% export revenue.",
    source: "Risk Management Report, Annual Report FY25 p.78-82 | DRHP Section III",
    reasoning: [
      { agent: "Agent Alpha", message: "Primary risk is raw material cost volatility. 40% of inputs are crude-linked. Every $10/bbl crude increase impacts EBITDA by ~150bps.", timestamp: "10:29:00", type: "analysis" },
      { agent: "Agent Beta", message: "Additional risk from Chinese dumping in commodity chemicals. Anti-dumping duties on 3 products expire in H2 FY27.", timestamp: "10:29:30", type: "analysis" },
      { agent: "Agent Gamma", message: "Environmental compliance costs increasing. CPCB Category A classification requires additional ₹80 Cr capex by FY28. Not yet provisioned in guidance.", timestamp: "10:30:00", type: "analysis" },
      { agent: "Monitor", message: "Comprehensive risk identification across all three agents. Environmental capex risk from Gamma is non-obvious and well-sourced. Score: 7.0/10. Confidence: 78%.", timestamp: "10:30:30", type: "verdict" },
    ],
  },
  {
    dimension: "Growth Trajectory", score: 8.0, maxScore: 10, confidence: 83,
    evidence: "Revenue CAGR of 18% over 3 years. New capacity addition of 30% coming online in H1 FY27. Order book visibility of 8 months.",
    source: "Investor Presentation Q3 FY26, Slide 24 | Annual Report FY25, p.15",
    reasoning: [
      { agent: "Agent Alpha", message: "Capacity utilization at 82%. New plant adds 30% capacity in H1 FY27. Long-term contracts provide revenue visibility of 8 months.", timestamp: "10:31:00", type: "analysis" },
      { agent: "Agent Beta", message: "Growth thesis is strong but dependent on timely capacity commissioning. Management has a history of 1-quarter delays on capex.", timestamp: "10:31:30", type: "challenge" },
      { agent: "Agent Gamma", message: "Sector tailwinds from China+1 strategy remain intact. India's share in global specialty chemicals expected to grow from 4% to 6% by FY28 (McKinsey report).", timestamp: "10:32:00", type: "agreement" },
      { agent: "Monitor", message: "Growth thesis well-supported by capacity addition and sector tailwinds. Execution risk noted by Beta is valid. Score: 8.0/10. Confidence: 83%.", timestamp: "10:32:30", type: "verdict" },
    ],
  },
];

export const candlestickData: CandlestickPoint[] = Array.from({ length: 60 }, (_, i) => {
  const baseDate = new Date(2026, 1, 1);
  baseDate.setDate(baseDate.getDate() + i);
  const base = 2000 + Math.sin(i / 10) * 150 + i * 2;
  const volatility = 30 + Math.random() * 20;
  const open = base + (Math.random() - 0.5) * volatility;
  const close = base + (Math.random() - 0.5) * volatility;
  const high = Math.max(open, close) + Math.random() * volatility * 0.5;
  const low = Math.min(open, close) - Math.random() * volatility * 0.5;
  return {
    date: baseDate.toISOString().split('T')[0],
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    close: Math.round(close * 100) / 100,
    volume: Math.round(300000 + Math.random() * 200000),
  };
});

export type Watchlist = {
  id: string;
  name: string;
  sector: string;
  cap: string;
  companies: string[];
  createdAt: string;
};

export const watchlists: Watchlist[] = [
  { id: "w1", name: "Specialty Chemicals - Mid Cap", sector: "Chemicals", cap: "Mid Cap", companies: ["1", "2", "3", "4"], createdAt: "2026-03-15" },
  { id: "w2", name: "Fine Chemicals - Small Cap", sector: "Chemicals", cap: "Small Cap", companies: ["6", "7", "8"], createdAt: "2026-03-20" },
];

export const reportSections = [
  {
    id: "s1",
    title: "Executive Summary",
    content: `Deepak Nitrite Ltd continues to demonstrate strong operational performance in Q3 FY26, with revenue growing 15.8% YoY to ₹2,380 Cr. The company's strategic pivot towards high-value specialty chemicals has yielded results, with the segment now contributing 62% of total revenue, up from 54% in FY24. EBITDA margins expanded by 130bps YoY to 25.6%, driven by favorable product mix and operating leverage from the Dahej facility.`,
    source: "BSE Filing Q3 FY26 Results, p.2 | Earnings Call Transcript Q3 FY26, timestamp 05:23",
    confidence: 88,
    shortTermFlag: false,
  },
  {
    id: "s2",
    title: "Revenue Analysis",
    content: `Q4 FY25 revenue showed a sequential decline of 13.2% to ₹1,780 Cr. This decline is primarily attributable to increased tax provisioning under Section 115BAA of the Income Tax Act, which resulted in a one-time deferred tax adjustment of ₹85 Cr. This is a short-term accounting impact and does not reflect any deterioration in the company's operational performance or market position.`,
    source: "Q4 FY25 Earnings Call Transcript, timestamp 15:32 | Annual Report FY25, Note 28, p.156",
    confidence: 92,
    shortTermFlag: true,
    shortTermNote: "⚡ SHORT-TERM FACTOR: The Q4 FY25 revenue decline of 13.2% QoQ is driven by tax provisioning under Section 115BAA (new tax regime transition). This is a one-time accounting adjustment. Operational revenue (adjusted) actually grew 3.2% QoQ. This does NOT impact the company's long-term growth trajectory or competitive position.",
  },
  {
    id: "s3",
    title: "Competitive Positioning",
    content: `Within the Indian specialty chemicals landscape, Deepak Nitrite holds a dominant position in phenol-acetone (45% domestic market share) and maintains the #2 global position in ATBS with 22% market share. The China+1 diversification strategy continues to benefit the company, with 12 new customer wins from European and American multinationals in H1 FY26.`,
    source: "CRISIL Industry Report 2025 | Investor Presentation Q3 FY26, Slide 18 | BSE Filing Investor Update Jan 2026",
    confidence: 85,
    shortTermFlag: false,
  },
  {
    id: "s4",
    title: "Management Credibility Assessment",
    content: `Over the last 4 quarters (Q4 FY25 to Q3 FY26), management has delivered on 6 of 10 key guidance metrics. Notable deviations include: (1) Capex guidance of ₹200 Cr vs actual ₹180 Cr (10% shortfall, delayed by one quarter), (2) Product launch timeline — 2 of 3 planned products launched on schedule. The pattern suggests moderately optimistic guidance with a tendency to overpromise on timelines while generally delivering on financial targets.`,
    source: "Earnings Call Transcripts Q4 FY25 through Q3 FY26 | BSE Project Updates",
    confidence: 72,
    shortTermFlag: false,
  },
  {
    id: "s5",
    title: "Risk Assessment",
    content: `Key risks identified: (1) Raw material sensitivity — 40% of inputs are crude-linked; every $10/bbl increase in crude impacts EBITDA by ~150bps. (2) Customer concentration — top 5 clients contribute 35% of revenue. (3) Regulatory risk — CPCB Category A classification requires additional environmental capex of ₹80 Cr by FY28, currently unprovisioned. (4) Anti-dumping duty expiry on 3 commodity chemical products in H2 FY27 may invite Chinese competition. (5) Forex exposure on 38.5% export revenue.`,
    source: "Annual Report FY25 Risk Management, p.78-82 | DRHP Section III | CPCB Notification dated 12-Jan-2026",
    confidence: 78,
    shortTermFlag: false,
  },
];
