import { create } from "zustand";

export interface CartItem {
  serviceId: string;
  serviceName: string;
  serviceSlug: string;
  categoryName: string;
  packageId: string;
  packageName: string;
  packageDescription: string;
  unitPrice: number;
  taxPercent: number;
  durationDays: number;
  features: string[];
  quantity: number;
}

export interface CustomerBillingDetails {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  billingAddress: string;
  gstin?: string;
}

interface CartState {
  items: CartItem[];
  paymentSchedule: "FULL" | "ADVANCE_50";
  couponCode: string | null;
  discountPercent: number;
  customerDetails: CustomerBillingDetails;
  
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (packageId: string) => void;
  clearCart: () => void;
  setPaymentSchedule: (schedule: "FULL" | "ADVANCE_50") => void;
  applyCoupon: (code: string) => { success: boolean; message: string };
  removeCoupon: () => void;
  setCustomerDetails: (details: Partial<CustomerBillingDetails>) => void;

  getSubtotal: () => number;
  getDiscountAmount: () => number;
  getTaxAmount: () => number;
  getTotalAmount: () => number;
  getAmountPayableNow: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  paymentSchedule: "FULL",
  couponCode: null,
  discountPercent: 0,
  customerDetails: {
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    billingAddress: "",
    gstin: "",
  },

  addItem: (item) => {
    // For service marketplace packages, replacing existing package keeps cart focused and prevents duplicate conflicting packages
    set({
      items: [{ ...item, quantity: 1 }],
    });
  },

  removeItem: (packageId) => {
    set((state) => ({
      items: state.items.filter((i) => i.packageId !== packageId),
      couponCode: null,
      discountPercent: 0,
    }));
  },

  clearCart: () => {
    set({
      items: [],
      paymentSchedule: "FULL",
      couponCode: null,
      discountPercent: 0,
    });
  },

  setPaymentSchedule: (schedule) => set({ paymentSchedule: schedule }),

  applyCoupon: (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean === "KRYPTON10") {
      set({ couponCode: "KRYPTON10", discountPercent: 10 });
      return { success: true, message: "10% KryptonIX discount applied!" };
    }
    if (clean === "LAUNCH20") {
      set({ couponCode: "LAUNCH20", discountPercent: 20 });
      return { success: true, message: "20% Launch partner discount applied!" };
    }
    return { success: false, message: "Invalid promo code. Try KRYPTON10" };
  },

  removeCoupon: () => set({ couponCode: null, discountPercent: 0 }),

  setCustomerDetails: (details) =>
    set((state) => ({
      customerDetails: { ...state.customerDetails, ...details },
    })),

  getSubtotal: () => {
    const items = get().items;
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  },

  getDiscountAmount: () => {
    const subtotal = get().getSubtotal();
    const percent = get().discountPercent;
    if (percent <= 0) return 0;
    return Math.round((subtotal * percent) / 100);
  },

  getTaxAmount: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    const taxableAmount = Math.max(0, subtotal - discount);
    // Standard 18% GST for digital & IT services
    return Math.round(taxableAmount * 0.18);
  },

  getTotalAmount: () => {
    const subtotal = get().getSubtotal();
    const discount = get().getDiscountAmount();
    const tax = get().getTaxAmount();
    return Math.max(0, subtotal - discount + tax);
  },

  getAmountPayableNow: () => {
    const total = get().getTotalAmount();
    if (get().paymentSchedule === "ADVANCE_50") {
      return Math.round(total / 2);
    }
    return total;
  },
}));
