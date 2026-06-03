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
    id: "1", 
    name: "Persistent Systems Ltd", 
    ticker: "PERSISTENT", 
    sector: "IT Services",
    cap: "Mid Cap", 
    price: 4785.60, 
    change: 45.20, 
    changePercent: 0.95,
    marketCap: "₹85,612 Cr", 
    pe: 42.8, 
    eps: 92.50, 
    weekHigh52: 5200, 
    weekLow52: 3800,
    volume: "2.8L", 
    avgVolume: "2.5L", 
    dividend: 0.80, 
    beta: 1.08,
    debtToEquity: 0.05, 
    roe: 30.4, 
    roce: 35.2, 
    promoterHolding: 30.30,
    overallScore: 88, 
    confidenceScore: 92,
  },
  {
    id: "2", 
    name: "Mphasis Ltd", 
    ticker: "MPHASIS", 
    sector: "IT Services",
    cap: "Mid Cap", 
    price: 2560.40, 
    change: -12.50, 
    changePercent: -0.49,
    marketCap: "₹51,209 Cr", 
    pe: 28.7, 
    eps: 93.90, 
    weekHigh52: 2950, 
    weekLow52: 2100,
    volume: "3.2L", 
    avgVolume: "2.9L", 
    dividend: 2.12, 
    beta: 0.92,
    debtToEquity: 0.12, 
    roe: 18.6, 
    roce: 22.1, 
    promoterHolding: 0.00,
    overallScore: 82, 
    confidenceScore: 87,
  },
  {
    id: "3", 
    name: "Newgen Software Technologies Ltd", 
    ticker: "NEWGEN", 
    sector: "Software Products",
    cap: "Mid Cap", 
    price: 945.20, 
    change: 18.70, 
    changePercent: 2.02,
    marketCap: "₹18,500 Cr", 
    pe: 65.2, 
    eps: 45.20, 
    weekHigh52: 1200, 
    weekLow52: 780,
    volume: "1.9L", 
    avgVolume: "1.7L", 
    dividend: 0.30, 
    beta: 1.15,
    debtToEquity: 0.02, 
    roe: 24.1, 
    roce: 28.5, 
    promoterHolding: 52.40,
    overallScore: 85, 
    confidenceScore: 89,
  },
  {
    id: "4", 
    name: "Tata Elxsi Ltd", 
    ticker: "TATAELXSI", 
    sector: "Design & Engineering",
    cap: "Mid Cap", 
    price: 6820.50, 
    change: 32.40, 
    changePercent: 0.48,
    marketCap: "₹42,500 Cr", 
    pe: 54.1, 
    eps: 142.30, 
    weekHigh52: 7800, 
    weekLow52: 5800,
    volume: "1.2L", 
    avgVolume: "1.1L", 
    dividend: 1.20, 
    beta: 0.85,
    debtToEquity: 0.00, 
    roe: 32.5, 
    roce: 38.7, 
    promoterHolding: 43.90,
    overallScore: 90, 
    confidenceScore: 94,
  },
  {
    id: "5", 
    name: "Cyient Ltd", 
    ticker: "CYIENT", 
    sector: "Engineering Services",
    cap: "Mid Cap", 
    price: 1780.30, 
    change: -8.20, 
    changePercent: -0.46,
    marketCap: "₹18,500 Cr", 
    pe: 38.2, 
    eps: 78.50, 
    weekHigh52: 2100, 
    weekLow52: 1450,
    volume: "2.1L", 
    avgVolume: "1.9L", 
    dividend: 1.80, 
    beta: 1.02,
    debtToEquity: 0.15, 
    roe: 17.8, 
    roce: 20.4, 
    promoterHolding: 23.10,
    overallScore: 76, 
    confidenceScore: 81,
  },
  {
    id: "6", 
    name: "KPIT Technologies Ltd", 
    ticker: "KPITTECH", 
    sector: "Automotive Software",
    cap: "Mid Cap", 
    price: 1425.80, 
    change: 25.60, 
    changePercent: 1.83,
    marketCap: "₹19,600 Cr", 
    pe: 28.6, 
    eps: 52.80, 
    weekHigh52: 1650, 
    weekLow52: 1180,
    volume: "4.5L", 
    avgVolume: "4.1L", 
    dividend: 0.90, 
    beta: 1.22,
    debtToEquity: 0.08, 
    roe: 42.5, 
    roce: 48.2, 
    promoterHolding: 39.80,
    overallScore: 87, 
    confidenceScore: 91,
  },
  {
    id: "7", 
    name: "Happiest Minds Technologies Ltd", 
    ticker: "HAPPSTMNDS", 
    sector: "Digital Transformation",
    cap: "Small Cap", 
    price: 825.40, 
    change: 12.30, 
    changePercent: 1.51,
    marketCap: "₹9,500 Cr", 
    pe: 33.4, 
    eps: 28.40, 
    weekHigh52: 1020, 
    weekLow52: 680,
    volume: "3.8L", 
    avgVolume: "3.4L", 
    dividend: 1.10, 
    beta: 1.05,
    debtToEquity: 0.03, 
    roe: 26.8, 
    roce: 31.2, 
    promoterHolding: 47.60,
    overallScore: 80, 
    confidenceScore: 85,
  },
  {
    id: "8", 
    name: "Tata Technologies Ltd", 
    ticker: "TATATECH", 
    sector: "Engineering Services",
    cap: "Mid Cap", 
    price: 925.70, 
    change: -5.80, 
    changePercent: -0.62,
    marketCap: "₹28,500 Cr", 
    pe: 58.7, 
    eps: 32.50, 
    weekHigh52: 1150, 
    weekLow52: 780,
    volume: "5.2L", 
    avgVolume: "4.8L", 
    dividend: 0.70, 
    beta: 1.18,
    debtToEquity: 0.12, 
    roe: 24.1, 
    roce: 27.8, 
    promoterHolding: 71.30,
    overallScore: 84, 
    confidenceScore: 88,
  },
];

export const getCompanyNews = (companyId: string): NewsItem[] => [
  {
    id: "n1", title: `${companies.find(c=>c.id===companyId)?.name} reports strong Q3 results, beats margin guidance`,
    source: "Economic Times", date: "2026-04-10",
    sentiment: "positive",
    summary: "Company reported revenue growth of 16% YoY with strong deal intake across BFSI and manufacturing segments. Operating margins expanded by 150bps.",
    url: "#",
  },
  {
    id: "n2", title: "IT services sector growth moderates amid global tech spending slowdown",
    source: "Business Standard", date: "2026-04-09",
    sentiment: "negative",
    summary: "Cooling global tech budgets expected to impact IT services growth rates in Q4 FY26. Wage inflation remains concerning for margin sustainability.",
    url: "#",
  },
  {
    id: "n3", title: "RBI cuts repo rate; IT stocks surge on software services uplift",
    source: "LiveMint", date: "2026-04-08",
    sentiment: "positive",
    summary: "The RBI reduced the repo rate by 25bps to 6.0%. IT services companies likely to benefit from lower rupee volatility and improved client spending.",
    url: "#",
  },
  {
    id: "n4", title: `${companies.find(c=>c.id===companyId)?.name} wins major cloud transformation deal`,
    source: "MoneyControl", date: "2026-04-07",
    sentiment: "positive",
    summary: "Secured 5-year contract worth $25M for cloud modernization from a Fortune 500 client, demonstrating strong competitive positioning in digital transformation space.",
    url: "#",
  },
  {
    id: "n5", title: "Tech talent attrition eases; IT companies raise FY27 hiring targets",
    source: "NDTV Profit", date: "2026-04-06",
    sentiment: "positive",
    summary: "Industry-wide attrition rates declined to 12% in Q3. Major IT service providers increased fresher hiring targets for FY27 by 15-20%.",
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
  { quarter: "Q4 FY25", said: "Revenue growth of 12-14% YoY", delivered: "Revenue growth at 13.8% YoY", deviation: 1.8, metric: "Revenue Growth", pattern: "consistent" },
  { quarter: "Q1 FY26", said: "Operating margin to remain in 18-20% range", delivered: "Operating margin at 19.2%", deviation: 1.2, metric: "Operating Margin", pattern: "underpromise" },
  { quarter: "Q2 FY26", said: "Deal wins of $150-180M", delivered: "Deal wins at $165M", deviation: 0, metric: "Deal Wins", pattern: "consistent" },
  { quarter: "Q3 FY26", said: "Attrition rate to stabilize at 13-15%", delivered: "Attrition at 12.1%", deviation: 2.9, metric: "Attrition Rate", pattern: "underpromise" },
  { quarter: "Q1 FY26", said: "FY26 revenue guidance of 14-16% growth", delivered: "FY26E revenue growth at 15.2%", deviation: 1.2, metric: "FY26 Guidance", pattern: "consistent" },
  { quarter: "Q2 FY26", said: "Capex of ₹80-100 Cr for IT infrastructure", delivered: "Capex of ₹95 Cr deployed", deviation: -5, metric: "Capex", pattern: "consistent" },
];

export const scoreCards: ScoreCard[] = [
  {
    dimension: "Industry Position", score: 8.2, maxScore: 10, confidence: 85,
    evidence: "Top-tier IT services player with strong positioning in cloud, AI, and digital transformation. Serves 250+ clients across 20+ industries across North America, Europe, and APAC.",
    source: "Annual Report FY25, p.8-10 | BSE Filing dated 15-Mar-2026",
    reasoning: [
      { agent: "Agent Alpha", message: "Based on Gartner report, the company ranks in Leader quadrant for Digital Consulting Services. Revenue CAGR of 16% over 5 years outpaces industry average of 11%.", timestamp: "10:23:15", type: "analysis" },
      { agent: "Agent Beta", message: "I challenge the market position. Recent revenue from cloud services is growing but still represents only 28% of total revenue vs industry peers at 35% average.", timestamp: "10:23:45", type: "challenge" },
      { agent: "Agent Gamma", message: "Agree with Beta's concern but Q3 FY26 earnings call confirmed strong cloud deal wins of $45M in quarter, indicating accelerating pivot. Cloud revenue expected to reach 35%+ by FY27.", timestamp: "10:24:12", type: "agreement" },
      { agent: "Monitor", message: "Alpha's market leadership claim is directionally correct but Beta raises valid concern about cloud penetration lag. Gamma's forward trajectory provides mitigation. Score: 8.2/10. Confidence: 85%.", timestamp: "10:24:30", type: "verdict" },
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
  { id: "w1", name: "IT Services - Core Tier", sector: "IT Services", cap: "Mid Cap", companies: ["1", "2", "4"], createdAt: "2026-03-15" },
  { id: "w2", name: "IT Niche & Emerging", sector: "IT Sector", cap: "Small Cap", companies: ["3", "6", "7"], createdAt: "2026-03-20" },
];

export const reportSections = [
  {
    id: "s1",
    title: "Executive Summary",
    content: `Persistent Systems Ltd continues to demonstrate strong operational performance in Q3 FY26, with revenue growing 12.8% YoY to ₹2,380 Cr. The company's strategic focus on cloud and AI-led digital transformation services has yielded results, with the segment now contributing 28% of total revenue, up from 20% in FY24. Operating margins remained stable at 19.2% YoY, demonstrating effective cost management despite wage inflation pressures across the industry.`,
    source: "BSE Filing Q3 FY26 Results, p.2 | Earnings Call Transcript Q3 FY26, timestamp 05:23",
    confidence: 88,
    shortTermFlag: false,
  },
  {
    id: "s2",
    title: "Revenue Analysis",
    content: `Q4 FY25 revenue showed a sequential decline of 8.2% to ₹1,850 Cr. This decline is primarily attributable to seasonal Q4 slowdown, which resulted in deal deferrals of approximately $8M to Q1 FY26. This is a short-term timing factor related to customer fiscal year-end budget freezes and does not reflect any deterioration in the company's demand environment or market position.`,
    source: "Q4 FY25 Earnings Call Transcript, timestamp 15:32 | Annual Report FY25, Note 28, p.156",
    confidence: 92,
    shortTermFlag: true,
    shortTermNote: "⚡ SHORT-TERM FACTOR: The Q4 FY25 revenue decline of 8.2% QoQ is driven by seasonal customer budget cycles and deal deferrals to Q1 FY26. Management confirmed backlog conversion of $8M of deferred deals in Q1 FY26 (realized). This is a short-term timing adjustment. Operational momentum remains strong with order book of $45M. This does NOT impact the company's long-term growth trajectory or competitive position.",
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
