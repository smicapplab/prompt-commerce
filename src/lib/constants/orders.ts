export const CHANNELS = [
  { value: "manual", label: "Manual Entry" },
  { value: "telegram", label: "Telegram" },
  { value: "facebook", label: "Facebook Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "viber", label: "Viber" },
];

export const STATUS_STEPS = [
  {
    id: "pending_payment",
    label: "Payment",
    icon: "M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z",
  },
  {
    id: "pending",
    label: "Pending",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "paid",
    label: "Paid",
    icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "picking",
    label: "Picking",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    id: "packing",
    label: "Packing",
    icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  },
  {
    id: "ready_for_pickup",
    label: "Ready",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
  {
    id: "in_transit",
    label: "In Transit",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  { id: "delivered", label: "Delivered", icon: "M5 13l4 4L19 7" },
];

export const STATUS_COLORS: Record<string, string> = {
  pending_payment: "text-orange-600 bg-orange-50 border-orange-200",
  pending: "text-amber-600 bg-amber-50 border-amber-200",
  paid: "text-blue-600 bg-blue-50 border-blue-200",
  picking: "text-indigo-600 bg-indigo-50 border-indigo-200",
  packing: "text-violet-600 bg-violet-50 border-violet-200",
  ready_for_pickup: "text-cyan-600 bg-cyan-50 border-cyan-200",
  picked_up: "text-emerald-600 bg-emerald-50 border-emerald-200",
  in_transit: "text-sky-600 bg-sky-50 border-sky-200",
  delivered: "text-emerald-600 bg-emerald-50 border-emerald-200",
  cancelled: "text-red-600 bg-red-50 border-red-200",
  refunded: "text-gray-600 bg-gray-50 border-gray-200",
};

export const STATUS_CHART_COLORS: Record<string, string> = {
  pending_payment: "bg-orange-400",
  pending: "bg-amber-400",
  paid: "bg-blue-400",
  picking: "bg-indigo-400",
  packing: "bg-violet-400",
  ready_for_pickup: "bg-cyan-400",
  picked_up: "bg-emerald-400",
  in_transit: "bg-sky-400",
  delivered: "bg-emerald-400",
  cancelled: "bg-red-400",
  refunded: "bg-gray-400",
};

export const STATUS_OPTIONS = [
  "pending_payment",
  "pending",
  "paid",
  "picking",
  "packing",
  "ready_for_pickup",
  "picked_up",
  "in_transit",
  "delivered",
  "cancelled",
  "refunded",
];
