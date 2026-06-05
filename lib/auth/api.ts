import { apiRequest } from "@/lib/api/client";
import type { LoginResponse, MeResponse, StaffUser } from "@/lib/api/types";

export async function loginRequest(payload: {
  phone_number: string;
  password: string;
}): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("login", {
    method: "POST",
    body: payload,
  });
}

export async function activateRequest(payload: {
  phone_number: string;
  otp: string;
  password: string;
  /** Required by the backend's `confirmed` rule — must equal `password`. */
  password_confirmation: string;
}): Promise<{ user: StaffUser }> {
  return apiRequest<{ user: StaffUser }>("activate", {
    method: "POST",
    body: payload,
  });
}

export async function resendActivationOtpRequest(payload: {
  phone_number: string;
}): Promise<null> {
  return apiRequest<null>("activation/resend", {
    method: "POST",
    body: payload,
  });
}

export async function requestPasswordResetOtpRequest(payload: {
  phone_number: string;
}): Promise<null> {
  return apiRequest<null>("password/otp", {
    method: "POST",
    body: payload,
  });
}

export async function resetPasswordRequest(payload: {
  phone_number: string;
  otp: string;
  password: string;
  /** Required by the backend's `confirmed` rule — must equal `password`. */
  password_confirmation: string;
}): Promise<null> {
  return apiRequest<null>("password/reset", {
    method: "POST",
    body: payload,
  });
}

export async function fetchMeRequest(token: string): Promise<MeResponse> {
  return apiRequest<MeResponse>("me", {
    method: "GET",
    token,
  });
}
