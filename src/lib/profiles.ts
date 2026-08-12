import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ExpeditionProfile } from "@/types/profile";

const value = (input: string | null | undefined) => input ?? "";

export async function loadProfile(userId: string): Promise<ExpeditionProfile> {
  const supabase = getSupabaseBrowserClient();
  const [profileResult, privateResult, travelResult, emergencyResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("profile_private_details").select("*").eq("user_id", userId).single(),
    supabase.from("profile_travel_documents").select("*").eq("user_id", userId).single(),
    supabase.from("profile_emergency_details").select("*").eq("user_id", userId).single(),
  ]);

  const error = profileResult.error ?? privateResult.error ?? travelResult.error ?? emergencyResult.error;
  if (error) throw error;
  if (!profileResult.data || !privateResult.data || !travelResult.data || !emergencyResult.data) {
    throw new Error("Your ExpeditionOS profile is incomplete.");
  }

  const profile = profileResult.data;
  const privateDetails = privateResult.data;
  const travel = travelResult.data;
  const emergency = emergencyResult.data;

  return {
    id: userId,
    firstName: value(profile.first_name),
    lastName: value(profile.last_name),
    displayName: value(profile.display_name),
    email: value(privateDetails.email),
    phone: value(privateDetails.phone),
    preferredOtpChannel: privateDetails.preferred_otp_channel === "sms" ? "sms" : "email",
    phoneVerified: privateDetails.phone_verified,
    gender: value(privateDetails.gender),
    genderDescription: value(privateDetails.gender_description),
    dateOfBirth: value(privateDetails.date_of_birth),
    addressLine1: value(privateDetails.address_line_1),
    addressLine2: value(privateDetails.address_line_2),
    city: value(privateDetails.city),
    province: value(privateDetails.province),
    country: value(privateDetails.country),
    saIdNumber: value(travel.sa_id_number),
    passportNumber: value(travel.passport_number),
    emergencyContactName: value(emergency.emergency_contact_name),
    emergencyContactPhone: value(emergency.emergency_contact_phone),
    medicalAidName: value(emergency.medical_aid_name),
    medicalAidNumber: value(emergency.medical_aid_number),
    bloodType: value(emergency.blood_type),
    allergies: value(emergency.allergies),
    doctorName: value(emergency.doctor_name),
    doctorPhone: value(emergency.doctor_phone),
    additionalInformation: value(emergency.additional_information),
  };
}

export async function saveProfile(profile: ExpeditionProfile) {
  const supabase = getSupabaseBrowserClient();
  const displayName = `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim();
  const nullable = (input: string) => input.trim() || null;

  const results = await Promise.all([
    supabase.from("profiles").update({
      first_name: profile.firstName.trim(),
      last_name: profile.lastName.trim(),
      display_name: displayName,
    }).eq("id", profile.id),
    supabase.from("profile_private_details").update({
      preferred_otp_channel: profile.preferredOtpChannel,
      gender: nullable(profile.gender),
      gender_description: nullable(profile.genderDescription),
      date_of_birth: nullable(profile.dateOfBirth),
      address_line_1: nullable(profile.addressLine1),
      address_line_2: nullable(profile.addressLine2),
      city: nullable(profile.city),
      province: nullable(profile.province),
      country: profile.country.trim() || "South Africa",
    }).eq("user_id", profile.id),
    supabase.from("profile_travel_documents").update({
      sa_id_number: nullable(profile.saIdNumber),
      passport_number: nullable(profile.passportNumber),
    }).eq("user_id", profile.id),
    supabase.from("profile_emergency_details").update({
      emergency_contact_name: nullable(profile.emergencyContactName),
      emergency_contact_phone: nullable(profile.emergencyContactPhone),
      medical_aid_name: nullable(profile.medicalAidName),
      medical_aid_number: nullable(profile.medicalAidNumber),
      blood_type: nullable(profile.bloodType),
      allergies: nullable(profile.allergies),
      doctor_name: nullable(profile.doctorName),
      doctor_phone: nullable(profile.doctorPhone),
      additional_information: nullable(profile.additionalInformation),
    }).eq("user_id", profile.id),
  ]);

  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(error.message);
  return { ...profile, displayName };
}
