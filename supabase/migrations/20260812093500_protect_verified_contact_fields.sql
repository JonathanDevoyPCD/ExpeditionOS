revoke update on public.profile_private_details from authenticated;
grant update (
  preferred_otp_channel,
  gender,
  gender_description,
  date_of_birth,
  address_line_1,
  address_line_2,
  city,
  province,
  country,
  updated_at
) on public.profile_private_details to authenticated;
