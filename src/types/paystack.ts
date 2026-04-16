export interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    customer: {
      email: string;
      customer_code: string;
    };
    plan?: {
      plan_code: string;
      subscription_code?: string;
    };
    metadata?: {
      userId?: string;
      cancel_action?: string;
    };
  };
}

export interface PaystackWebhookEvent {
  event: string;
  data: {
    customer: {
      email: string;
      customer_code: string;
    };
    plan?: {
      plan_code: string;
    };
    subscription_code?: string;
    next_payment_date?: string;
    amount?: number;
    currency?: string;
    metadata?: {
      userId?: string;
    };
  };
}

export interface CheckoutSessionRequest {
  userId: string;
  userEmail: string;
}

export interface CheckoutSessionResponse {
  url: string;
  reference: string;
  access_code: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  userId?: string;
  email?: string;
  planCode?: string;
  subscriptionCode?: string;
  amount?: number;
  currency?: string;
  status?: string;
  error?: string;
}
