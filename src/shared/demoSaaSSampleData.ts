// Pure client-side realistic sample data and initial state generators
// for the 4 GitStack B2B SaaS interactive product demos:
// 1. Gitstack Inventory Sync (Omnichannel Retail & E-Commerce)
// 2. Gitstack E-Invoice (BIR EIS Electronic Invoicing)
// 3. Gitstack AI Concierge (Automated Customer Service & Bookings)
// 4. Gitstack FlowCRM (Service Business Pipeline & Invoice Chaser)

// ==========================================
// 1. GITSTACK INVENTORY SYNC DATA
// ==========================================

export interface InventorySkuItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  warehouseStock: number;
  channelAllocation: {
    physicalStore: number;
    shopee: number;
    lazada: number;
    tiktokShop: number;
  };
  reorderPoint: number;
  unitCostPhp: number;
  sellingPricePhp: number;
  updatedAt: string;
}

export interface InventoryActivityLog {
  id: string;
  timestamp: string;
  channel: 'Shopee' | 'TikTok Shop' | 'Lazada' | 'Physical Store' | 'Main Warehouse';
  action: string;
  sku: string;
  quantityChange: number;
  newWarehouseStock: number;
  type: 'sale' | 'restock' | 'alert';
}

export const INITIAL_INVENTORY_SKUS: InventorySkuItem[] = [
  {
    id: 'sku-001',
    sku: 'AUD-WL-01',
    name: 'Pro Wireless ANC Earbuds (Matte Black)',
    category: 'Consumer Electronics',
    warehouseStock: 42,
    channelAllocation: { physicalStore: 8, shopee: 14, lazada: 12, tiktokShop: 8 },
    reorderPoint: 15,
    unitCostPhp: 1100,
    sellingPricePhp: 2490,
    updatedAt: 'Just now'
  },
  {
    id: 'sku-002',
    sku: 'DRK-SS-32',
    name: 'Insulated Stainless Tumbler 950ml',
    category: 'Lifestyle & Home',
    warehouseStock: 18,
    channelAllocation: { physicalStore: 4, shopee: 6, lazada: 5, tiktokShop: 3 },
    reorderPoint: 20,
    unitCostPhp: 420,
    sellingPricePhp: 980,
    updatedAt: '2 mins ago'
  },
  {
    id: 'sku-003',
    sku: 'BAG-CV-LG',
    name: 'Heavyweight Canvas Field Tote (Olive)',
    category: 'Apparel & Bags',
    warehouseStock: 6,
    channelAllocation: { physicalStore: 2, shopee: 2, lazada: 1, tiktokShop: 1 },
    reorderPoint: 12,
    unitCostPhp: 280,
    sellingPricePhp: 750,
    updatedAt: '5 mins ago'
  },
  {
    id: 'sku-004',
    sku: 'PER-MS-02',
    name: 'Ergonomic Vertical Bluetooth Mouse',
    category: 'Computer Accessories',
    warehouseStock: 29,
    channelAllocation: { physicalStore: 5, shopee: 10, lazada: 9, tiktokShop: 5 },
    reorderPoint: 10,
    unitCostPhp: 650,
    sellingPricePhp: 1450,
    updatedAt: '12 mins ago'
  },
  {
    id: 'sku-005',
    sku: 'KB-MC-87',
    name: 'Compact Mechanical Keyboard (Hot-swap)',
    category: 'Computer Accessories',
    warehouseStock: 35,
    channelAllocation: { physicalStore: 6, shopee: 11, lazada: 12, tiktokShop: 6 },
    reorderPoint: 10,
    unitCostPhp: 1450,
    sellingPricePhp: 3200,
    updatedAt: '25 mins ago'
  },
  {
    id: 'sku-006',
    sku: 'APP-LN-03',
    name: 'Premium Breathable Linen Shirt (White/L)',
    category: 'Apparel & Bags',
    warehouseStock: 11,
    channelAllocation: { physicalStore: 3, shopee: 4, lazada: 2, tiktokShop: 2 },
    reorderPoint: 15,
    unitCostPhp: 550,
    sellingPricePhp: 1290,
    updatedAt: '30 mins ago'
  },
  {
    id: 'sku-007',
    sku: 'COF-DR-01',
    name: 'Pour-Over Stainless Coffee Dripper & Stand',
    category: 'Kitchen & Dining',
    warehouseStock: 53,
    channelAllocation: { physicalStore: 10, shopee: 18, lazada: 15, tiktokShop: 10 },
    reorderPoint: 15,
    unitCostPhp: 380,
    sellingPricePhp: 890,
    updatedAt: '40 mins ago'
  },
  {
    id: 'sku-008',
    sku: 'TRV-PCH-04',
    name: 'Waterproof Tech Organizer Travel Pouch',
    category: 'Lifestyle & Home',
    warehouseStock: 8,
    channelAllocation: { physicalStore: 2, shopee: 3, lazada: 2, tiktokShop: 1 },
    reorderPoint: 10,
    unitCostPhp: 220,
    sellingPricePhp: 590,
    updatedAt: '1 hour ago'
  }
];

export const INITIAL_INVENTORY_LOGS: InventoryActivityLog[] = [
  {
    id: 'log-101',
    timestamp: '10:42 AM',
    channel: 'Shopee',
    action: 'Order #SHP-9921 confirmed (2x Wireless Earbuds)',
    sku: 'AUD-WL-01',
    quantityChange: -2,
    newWarehouseStock: 42,
    type: 'sale'
  },
  {
    id: 'log-102',
    timestamp: '10:35 AM',
    channel: 'TikTok Shop',
    action: 'Live stream checkout #TT-4820 (3x Canvas Tote)',
    sku: 'BAG-CV-LG',
    quantityChange: -3,
    newWarehouseStock: 6,
    type: 'alert'
  },
  {
    id: 'log-103',
    timestamp: '10:15 AM',
    channel: 'Main Warehouse',
    action: 'Batch PO #WH-551 Received & Verified (+25 units)',
    sku: 'COF-DR-01',
    quantityChange: +25,
    newWarehouseStock: 53,
    type: 'restock'
  },
  {
    id: 'log-104',
    timestamp: '09:50 AM',
    channel: 'Lazada',
    action: 'Express Order #LZD-1033 (1x Ergonomic Mouse)',
    sku: 'PER-MS-02',
    quantityChange: -1,
    newWarehouseStock: 29,
    type: 'sale'
  }
];

// ==========================================
// 2. GITSTACK E-INVOICE DATA (BIR EIS)
// ==========================================

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPricePhp: number;
  discountPhp?: number;
}

export interface EInvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientTin: string;
  clientAddress: string;
  businessScenario: 'Retail POS Sale' | 'B2B Service Retainer' | 'E-Commerce Order';
  invoiceDate: string;
  items: InvoiceLineItem[];
  vatableSalesPhp: number;
  vatAmountPhp: number;
  totalAmountDuePhp: number;
  status: 'Transmitted' | 'Validated' | 'Pending';
  jwsSignature: string;
  birSubmissionUuid: string;
}

export const INVOICE_SCENARIO_PRESETS: Record<
  'Retail POS Sale' | 'B2B Service Retainer' | 'E-Commerce Order',
  {
    clientName: string;
    clientTin: string;
    clientAddress: string;
    items: InvoiceLineItem[];
  }
> = {
  'Retail POS Sale': {
    clientName: 'Metro Retail Trading Corp.',
    clientTin: '009-482-110-000',
    clientAddress: 'Units 402-404 Ayala Commercial Tower, Makati City 1226',
    items: [
      { id: 'item-1', description: 'POS Barcode Scanner Handheld USB', quantity: 2, unitPricePhp: 3850 },
      { id: 'item-2', description: 'Thermal Receipt Paper Roll 80x80 (Box of 50)', quantity: 4, unitPricePhp: 1450 },
      { id: 'item-3', description: 'Cash Drawer Electronic RJ11 Interface', quantity: 1, unitPricePhp: 4200 }
    ]
  },
  'B2B Service Retainer': {
    clientName: 'Pacific Rim Logistics & Hauling Services Inc.',
    clientTin: '184-902-331-000',
    clientAddress: 'Km. 19 South Superhighway, Parañaque City 1700',
    items: [
      { id: 'item-1', description: 'Monthly Cloud ERP & Inventory Infrastructure Retainer', quantity: 1, unitPricePhp: 45000 },
      { id: 'item-2', description: 'Fleet Telematics & Route Optimization API Maintenance', quantity: 1, unitPricePhp: 25000 },
      { id: 'item-3', description: 'Dedicated Senior DevOps SLA Support (24/7 Priority)', quantity: 1, unitPricePhp: 18000 }
    ]
  },
  'E-Commerce Order': {
    clientName: 'AeroTech Gadgets Philippines Co.',
    clientTin: '320-119-874-000',
    clientAddress: '88 C-5 Road, Bagong Ilog, Pasig City 1600',
    items: [
      { id: 'item-1', description: 'Omnichannel API Sync Gateway License (Annual)', quantity: 1, unitPricePhp: 36000 },
      { id: 'item-2', description: 'Multi-Store Catalog Migration & Barcode Mapping', quantity: 1, unitPricePhp: 12500 },
      { id: 'item-3', description: 'Custom Shopee & TikTok Webhook Integrator', quantity: 1, unitPricePhp: 9500 }
    ]
  }
};

export const INITIAL_RECENT_INVOICES: EInvoiceRecord[] = [
  {
    id: 'inv-2026-0881',
    invoiceNumber: 'INV-2026-0881',
    clientName: 'Metro Retail Trading Corp.',
    clientTin: '009-482-110-000',
    clientAddress: 'Ayala Commercial Tower, Makati City',
    businessScenario: 'Retail POS Sale',
    invoiceDate: '2026-11-15',
    items: [
      { id: 'i-1', description: 'POS Barcode Scanner Handheld', quantity: 2, unitPricePhp: 3850 },
      { id: 'i-2', description: 'Thermal Receipt Rolls', quantity: 4, unitPricePhp: 1450 }
    ],
    vatableSalesPhp: 12053.57,
    vatAmountPhp: 1446.43,
    totalAmountDuePhp: 13500.0,
    status: 'Validated',
    jwsSignature: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9...8K3vM',
    birSubmissionUuid: 'BIR-EIS-20261115-992140'
  },
  {
    id: 'inv-2026-0880',
    invoiceNumber: 'INV-2026-0880',
    clientName: 'Cebu Apex Manufacturing Corp.',
    clientTin: '211-094-672-000',
    clientAddress: 'Mandaue Reclamation Area, Cebu',
    businessScenario: 'B2B Service Retainer',
    invoiceDate: '2026-11-14',
    items: [
      { id: 'i-1', description: 'Warehouse Automation Software Retainer', quantity: 1, unitPricePhp: 48000 }
    ],
    vatableSalesPhp: 42857.14,
    vatAmountPhp: 5142.86,
    totalAmountDuePhp: 48000.0,
    status: 'Validated',
    jwsSignature: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9...9xL2p',
    birSubmissionUuid: 'BIR-EIS-20261114-118492'
  },
  {
    id: 'inv-2026-0879',
    invoiceNumber: 'INV-2026-0879',
    clientName: 'Golden Peak Logistics Solutions',
    clientTin: '450-881-209-000',
    clientAddress: 'North Harbor Port Area, Manila',
    businessScenario: 'B2B Service Retainer',
    invoiceDate: '2026-11-14',
    items: [
      { id: 'i-1', description: 'Dispatch Route Telemetry Maintenance', quantity: 1, unitPricePhp: 22400 }
    ],
    vatableSalesPhp: 20000.0,
    vatAmountPhp: 2400.0,
    totalAmountDuePhp: 22400.0,
    status: 'Transmitted',
    jwsSignature: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9...5wQ1a',
    birSubmissionUuid: 'BIR-EIS-20261114-774019'
  },
  {
    id: 'inv-2026-0878',
    invoiceNumber: 'INV-2026-0878',
    clientName: 'Highland Artisan Bakery Group',
    clientTin: '109-772-540-000',
    clientAddress: 'Session Road, Baguio City',
    businessScenario: 'Retail POS Sale',
    invoiceDate: '2026-11-13',
    items: [
      { id: 'i-1', description: 'Custom POS Cloud Register License', quantity: 1, unitPricePhp: 16800 }
    ],
    vatableSalesPhp: 15000.0,
    vatAmountPhp: 1800.0,
    totalAmountDuePhp: 16800.0,
    status: 'Validated',
    jwsSignature: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9...3vM8k',
    birSubmissionUuid: 'BIR-EIS-20261113-640192'
  },
  {
    id: 'inv-2026-0877',
    invoiceNumber: 'INV-2026-0877',
    clientName: 'Vanguard Medical Supplies PH',
    clientTin: '008-331-904-000',
    clientAddress: 'E. Rodriguez Ave, Quezon City',
    businessScenario: 'E-Commerce Order',
    invoiceDate: '2026-11-12',
    items: [
      { id: 'i-1', description: 'B2B Ordering Gateway Subscription', quantity: 1, unitPricePhp: 33600 }
    ],
    vatableSalesPhp: 30000.0,
    vatAmountPhp: 3600.0,
    totalAmountDuePhp: 33600.0,
    status: 'Pending',
    jwsSignature: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXUyJ9...1xZ7b',
    birSubmissionUuid: 'BIR-EIS-20261112-550912'
  }
];

// ==========================================
// 3. GITSTACK AI CONCIERGE DATA
// ==========================================

export interface ConciergePersona {
  id: 'dental' | 'auto' | 'packaging';
  name: string;
  tagline: string;
  businessType: string;
  operatingHours: string;
  location: string;
  initialGreeting: string;
  priceList: { service: string; pricePhp: number; note: string }[];
  availableSlots: string[];
  suggestedPrompts: string[];
}

export const CONCIERGE_PERSONAS: Record<'dental' | 'auto' | 'packaging', ConciergePersona> = {
  dental: {
    id: 'dental',
    name: 'SmileCare Dental Clinic',
    tagline: 'Modern Painless Family & Aesthetic Dentistry',
    businessType: 'Healthcare / Dental Clinic',
    operatingHours: 'Mon–Sat: 9:00 AM – 6:00 PM (Closed Sundays)',
    location: '2nd Floor, Medicity Plaza, Ortigas Center, Pasig City',
    initialGreeting:
      'Hello! Welcome to SmileCare Dental Clinic. I can help you check treatment rates, verify Saturday slots, or reserve an appointment with Dr. Aris. What treatment can I assist you with today?',
    suggestedPrompts: [
      'How much is teeth whitening and are you open Saturday?',
      'Can I book a dental cleaning tomorrow at 2:00 PM?',
      'Do you do wisdom tooth extraction and what are the rates?',
      'Where is your clinic located and is there parking?'
    ],
    priceList: [
      { service: 'Comprehensive Oral Exam & Digital X-Ray', pricePhp: 800, note: 'Included in first cleaning' },
      { service: 'Prophylaxis (Ultrasonic Dental Cleaning)', pricePhp: 1500, note: 'Takes ~45 minutes' },
      { service: 'In-Office LED Laser Teeth Whitening', pricePhp: 7500, note: '1-hour shade lightening' },
      { service: 'Impacted Wisdom Tooth Surgery', pricePhp: 9500, note: 'Per tooth with local anesthesia' },
      { service: 'Ceramic Crown Restoration', pricePhp: 14000, note: 'Zirconia / 2 clinic visits' }
    ],
    availableSlots: ['Today 3:30 PM', 'Tomorrow 10:00 AM', 'Tomorrow 2:00 PM', 'Saturday 11:30 AM', 'Saturday 4:00 PM']
  },
  auto: {
    id: 'auto',
    name: 'Apex Auto Service Center',
    tagline: 'Precision European & Japanese Vehicle Maintenance',
    businessType: 'Automotive Repair & Preventive Maintenance',
    operatingHours: 'Mon–Sat: 8:00 AM – 5:30 PM',
    location: 'Km. 14 West Service Road, Bicutan, Parañaque City',
    initialGreeting:
      'Hi there! Welcome to Apex Auto Service Center. I can check PMS packages, brake servicing rates, or schedule your vehicle for computerized diagnosis. How can I help you and your car today?',
    suggestedPrompts: [
      'How much is 20k-km PMS for a Toyota Fortuner?',
      'My brake makes squeaking sounds. Can I book a checkup tomorrow?',
      'Do you handle European cars like BMW or Audi?',
      'What are your shop hours and can I wait in the lounge?'
    ],
    priceList: [
      { service: 'Comprehensive 40-Point Safety Inspection', pricePhp: 950, note: 'Free with any oil service' },
      { service: 'Full Synthetic Oil Change (Up to 4L)', pricePhp: 3850, note: 'Motul 5W-40 + OEM filter' },
      { service: 'Front & Rear Brake Pad Replacement', pricePhp: 4800, note: 'Ceramic pads + rotor resurfacing' },
      { service: 'Computerized OBD2 Engine Diagnostics', pricePhp: 1800, note: 'Full fault code scan & printout' },
      { service: 'Aircon Evaporator Deep Chemical Cleaning', pricePhp: 6500, note: 'Zero-dashboard dismantling' }
    ],
    availableSlots: ['Today 4:00 PM', 'Tomorrow 9:00 AM', 'Tomorrow 1:30 PM', 'Friday 10:00 AM', 'Saturday 8:30 AM']
  },
  packaging: {
    id: 'packaging',
    name: 'Metro B2B Packaging Supply',
    tagline: 'Eco-Friendly Corrugated Boxes, Pouches & Custom Branding',
    businessType: 'B2B Wholesale Packaging Manufacturer',
    operatingHours: 'Mon–Fri: 8:30 AM – 5:00 PM',
    location: 'Warehouse 7, Valenzuela Industrial Park, Valenzuela City',
    initialGreeting:
      'Good day! Welcome to Metro B2B Packaging Supply. We provide custom die-cut kraft boxes, mailer pouches, and branded tape for growing e-commerce brands. How many units do you need quote for?',
    suggestedPrompts: [
      'Do you have bulk kraft mailer boxes in stock?',
      'What is the minimum order quantity for custom branded tape?',
      'How much are 500 pcs of corrugated shipping boxes (Size M)?',
      'Can you deliver bulk cartons to Cavite and what is the lead time?'
    ],
    priceList: [
      { service: 'Kraft E-Commerce Mailer Boxes (Size S, 50pcs)', pricePhp: 1250, note: '₱25/pc · In Stock' },
      { service: 'Heavy-Duty Corrugated Cartons (Size M, 100pcs)', pricePhp: 4800, note: '₱48/pc · Double-wall' },
      { service: 'Biodegradable Poly Mailers (Pack of 200)', pricePhp: 1600, note: '₱8/pc · Matte finish' },
      { service: 'Custom Logo Printed Packing Tape (12 Rolls)', pricePhp: 3600, note: '₱300/roll · 100m length' },
      { service: 'Honeycomb Paper Cushion Roll (50cm x 100m)', pricePhp: 1450, note: 'Eco bubble-wrap alternative' }
    ],
    availableSlots: ['Pickup Today 2:00 PM', 'Bulk Delivery Tomorrow', 'Sample Dispatch Friday', 'Consultation Mon 10:00 AM']
  }
};

export interface ConciergeChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  hasAction?: 'booking' | 'order';
  actionData?: {
    serviceName: string;
    pricePhp: number;
    proposedSlot?: string;
  };
}

export interface CapturedBookingRecord {
  id: string;
  personaId: 'dental' | 'auto' | 'packaging';
  clientName: string;
  contactNumber: string;
  serviceTitle: string;
  totalPhp: number;
  scheduledTime: string;
  channel: 'Web Chat' | 'Messenger' | 'Viber';
  confirmedAt: string;
  status: 'Confirmed' | 'Dispatched';
}

export const INITIAL_CAPTURED_BOOKINGS: CapturedBookingRecord[] = [
  {
    id: 'book-401',
    personaId: 'dental',
    clientName: 'Camille Tan',
    contactNumber: '+63 917 849 2011',
    serviceTitle: 'In-Office LED Laser Teeth Whitening',
    totalPhp: 7500,
    scheduledTime: 'Saturday 11:30 AM',
    channel: 'Web Chat',
    confirmedAt: '10 mins ago',
    status: 'Confirmed'
  },
  {
    id: 'book-402',
    personaId: 'auto',
    clientName: 'Engr. Dan Reyes',
    contactNumber: '+63 920 902 4432',
    serviceTitle: 'Full Synthetic Oil Change & 40-pt Check',
    totalPhp: 3850,
    scheduledTime: 'Tomorrow 9:00 AM',
    channel: 'Messenger',
    confirmedAt: '25 mins ago',
    status: 'Confirmed'
  },
  {
    id: 'book-403',
    personaId: 'packaging',
    clientName: 'Aero Apparel Brand (attn: Marco)',
    contactNumber: '+63 918 554 1109',
    serviceTitle: 'Heavy-Duty Corrugated Cartons (500 pcs)',
    totalPhp: 24000,
    scheduledTime: 'Bulk Delivery Tomorrow',
    channel: 'Viber',
    confirmedAt: '1 hour ago',
    status: 'Dispatched'
  }
];

// ==========================================
// 4. GITSTACK FLOWCRM DATA (INVOICE CHASER)
// ==========================================

export type FlowCrmStage = 'new_inquiry' | 'quote_sent' | 'in_progress' | 'overdue_invoice';

export interface FlowCrmDeal {
  id: string;
  clientName: string;
  companyName: string;
  projectTitle: string;
  stage: FlowCrmStage;
  amountPhp: number;
  daysElapsed: number;
  invoiceNumber?: string;
  invoiceDueDate?: string;
  contactEmail: string;
  contactMobile: string;
  clientPaymentStatus?: 'unpaid' | 'paid';
  lastReminderSentAt?: string;
}

export const INITIAL_FLOW_CRM_DEALS: FlowCrmDeal[] = [
  {
    id: 'deal-01',
    clientName: 'Patricia Gomez',
    companyName: 'Luxe Spaces Design Studio',
    projectTitle: 'Commercial Interior Renovation & Lighting Design',
    stage: 'overdue_invoice',
    amountPhp: 85000,
    daysElapsed: 42,
    invoiceNumber: 'INV-2026-0412',
    invoiceDueDate: 'Nov 01, 2026 (14 Days Overdue)',
    contactEmail: 'patricia@luxespaces.ph',
    contactMobile: '+63 917 554 9921',
    clientPaymentStatus: 'unpaid',
    lastReminderSentAt: '2 days ago'
  },
  {
    id: 'deal-02',
    clientName: 'Atty. Victor Santos',
    companyName: 'Santos & Partners Law Firm',
    projectTitle: 'Monthly Corporate Tax & Retainer (Q4 Retainer)',
    stage: 'overdue_invoice',
    amountPhp: 45000,
    daysElapsed: 38,
    invoiceNumber: 'INV-2026-0419',
    invoiceDueDate: 'Nov 05, 2026 (10 Days Overdue)',
    contactEmail: 'vsantos@santoslaw.ph',
    contactMobile: '+63 920 883 4012',
    clientPaymentStatus: 'unpaid',
    lastReminderSentAt: 'Yesterday'
  },
  {
    id: 'deal-03',
    clientName: 'Marissa Lee',
    companyName: 'Apex Culinary & Events Corp.',
    projectTitle: 'Corporate Year-End Banquet Catering (300 Pax)',
    stage: 'in_progress',
    amountPhp: 165000,
    daysElapsed: 14,
    invoiceNumber: 'INV-2026-0428',
    invoiceDueDate: 'Nov 30, 2026',
    contactEmail: 'marissa@apexculinary.ph',
    contactMobile: '+63 918 332 9901',
    clientPaymentStatus: 'unpaid'
  },
  {
    id: 'deal-04',
    clientName: 'Arch. Gerald Tan',
    companyName: 'Vanguard Structural Consultants',
    projectTitle: 'Office Network Infrastructure & Server Setup',
    stage: 'in_progress',
    amountPhp: 92000,
    daysElapsed: 9,
    invoiceNumber: 'INV-2026-0431',
    invoiceDueDate: 'Dec 05, 2026',
    contactEmail: 'gtan@vanguardstruct.com',
    contactMobile: '+63 922 441 8023',
    clientPaymentStatus: 'unpaid'
  },
  {
    id: 'deal-05',
    clientName: 'Dr. Katherine Chua',
    companyName: 'Chua Dermatology & Aesthetic Care',
    projectTitle: 'Brand Identity & Digital Booking Portal Redesign',
    stage: 'quote_sent',
    amountPhp: 55000,
    daysElapsed: 4,
    contactEmail: 'katherine@chuaderm.com',
    contactMobile: '+63 917 220 9144'
  },
  {
    id: 'deal-06',
    clientName: 'Ramon Dimaculangan',
    companyName: 'North Star Cold Storage & Logistics',
    projectTitle: 'Warehouse Temperature Telemetry & IoT Integration',
    stage: 'new_inquiry',
    amountPhp: 120000,
    daysElapsed: 1,
    contactEmail: 'ramon@northstarlogistics.ph',
    contactMobile: '+63 920 119 5543'
  }
];
