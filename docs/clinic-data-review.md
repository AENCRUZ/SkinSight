# Clinic directory review

Generated from `frontend/js/clinics-data.js` on 2026-11-22. **Nothing in the data was changed, added or removed.**

## Key facts
- The directory has **27 clinic entries** (an earlier audit note said 55; that number counted every `name:` line including doctors).
- Cities covered: Batangas City, Lipa City, Santo Tomas, Tanauan City, Lemery, Bauan, Balayan, Nasugbu.
- I could not verify any entry from inside this project (no authoritative source is recorded in the data). **Every entry below is UNVERIFIED** until someone confirms it against the clinic's own channel (official website/Facebook page, a phone call, or the hospital/clinic directory).
- All entries have the same stored flags: `isOpen: true`, `reopenText: "Open Now"`, `verifiedOnGoogleMaps: true`, with ratings between 4.6 and 4.9 and review counts between 42 and 240. These values are identical in kind across all clinics, no source is recorded, and they cannot be live data.

## What the app now does with this data
| Field | Before | Now |
|---|---|---|
| `isOpen` / "Open Now" | Static "Open Now" on every clinic | Computed from the **listed hours** in Philippine time, labelled "Open now (listed hours)" / "Closed now (listed hours)", with a tooltip saying hours are unverified. Unreadable hours show "Hours unconfirmed". |
| "Accepting patients" | Shown on every doctor | "Availability not confirmed" |
| "N dermatologists" badge | Counted generic staff labels as dermatologists | "N listed doctors" |
| "verified clinic(s)", "licensed", "On Google Maps" badge, "verified contact details" | Claims of verification | Removed or reworded to "listed"; a directory notice appears on the finder and details pages |
| `rating`, `reviewCount`, `verifiedOnGoogleMaps` | Stored but never displayed | Still stored, still not displayed, now documented as untrusted |
| Teleconsult | Shown as fact | Still shown as listed; details page says "(unconfirmed)" |

## Recommended labelling for information that cannot be verified
- Keep the page-level notice: *"Directory details aren't verified. Please contact the clinic to confirm before you visit."*
- Keep "listed hours" wording on every open/closed badge.
- Do **not** show ratings, review counts, or "verified" unless a source is recorded per clinic.
- Do **not** show credentials such as "FPDS" or "MD" unless the doctor is confirmed (for example on the Philippine Dermatological Society directory).
- Once an entry is confirmed, add a per-entry `verifiedOn` date and `source` and then the UI can show a "Confirmed on <date>" badge for that entry only.

## Per-entry checklist (for Lemuel / the team)
Fill the last column with the source used and the date. Priority fields: **phone, email, hours**.

| # | id | Clinic | City | Listed hours | Phone | Email | Flags | Source / date verified |
|---|---|---|---|---|---|---|---|---|
| 1 | `skinstation-sm-batangas` | SkinStation — SM City Batangas | Batangas City | Mon–Sun, 10:00 AM – 9:00 PM | (043) 723-8891 | smbatangas@skinstation.ph | 1 generic staff label(s): Resident Medical Doctor & Laser Specialist | |
| 2 | `dermstrata-sm-batangas` | Dermstrata Skin Clinic & Spa — SM City Batangas | Batangas City | Mon–Sun, 10:00 AM – 9:00 PM | (043) 723-4521 | smbatangas@dermstrata.com.ph | 1 generic staff label(s): Resident Clinic Physician & Aesthetician | |
| 3 | `flawless-sm-batangas` | Flawless Face & Body Clinic — SM City Batangas | Batangas City | Mon–Sun, 10:00 AM – 9:00 PM | (043) 722-1144 | batangas@flawless.com.ph | 1 generic staff label(s): Resident Aesthetic Physician | |
| 4 | `dr-dumont-domingo-derma` | Dr. Dumont I. Domingo Dermatology Clinic | Batangas City | Mon–Sat, 9:00 AM – 5:00 PM | (043) 706-9421 | dr.dumont.domingo@gmail.com | 1 named doctor(s) with credentials: Dr. Dumont I. Domingo, FPDS<br>uses a free-mail address (gmail/yahoo/...)<br>claims teleconsultation | |
| 5 | `lira-buenafe-skin-clinic` | Lira-Buenafe Skin Clinic | Batangas City | Mon–Sat, 9:00 AM – 5:00 PM | (043) 980-0478 | lirabuenafe.skin@gmail.com | 1 named doctor(s) with credentials: Dr. Lizelle Joselyn Lira-Buenafe, FPDS<br>uses a free-mail address (gmail/yahoo/...)<br>claims teleconsultation | |
| 6 | `aguado-aesthetic-pathologic-derma` | Aguado Aesthetic and Pathologic Dermatology Clinic | Batangas City | Mon–Sat, 9:00 AM – 5:30 PM | (043) 722-0332 | aguado.derma@gmail.com | 2 named doctor(s) with credentials: Dr. Mary Ann P. Aguado, FPDS; Dr. Maria Jenina Aguado-De Chavez, FPDS<br>uses a free-mail address (gmail/yahoo/...)<br>claims teleconsultation | |
| 7 | `batangas-med-center-derma` | Batangas Medical Center — Department of Dermatology | Batangas City | Mon–Fri, 8:00 AM – 5:00 PM | (043) 740-8303 | dermatology@batmc.doh.gov.ph | 1 generic staff label(s): BatMC Department of Dermatology<br>claims teleconsultation | |
| 8 | `batangas-healthcare-specialists-derma` | Batangas Healthcare Specialists Medical Center — Dermatology | Batangas City | Mon–Sat, 8:30 AM – 4:30 PM | (043) 741-2888 | info@bhsmc.com.ph | 1 generic staff label(s): BHSMC Dermatology Specialty Clinic<br>claims teleconsultation | |
| 9 | `skinstation-sm-lipa` | SkinStation — SM City Lipa | Lipa City | Mon–Sun, 10:00 AM – 9:00 PM | (043) 784-0125 | smlipa@skinstation.ph | 1 generic staff label(s): Resident Medical Doctor & Laser Specialist | |
| 10 | `dermstrata-robinsons-lipa` | Dermstrata Skin Clinic — Robinsons Place Lipa | Lipa City | Mon–Sun, 10:00 AM – 8:00 PM | (043) 756-2918 | robinsonslipa@dermstrata.com.ph | 1 generic staff label(s): Resident Clinic Physician & Aesthetician | |
| 11 | `medical-city-clinic-lipa` | The Medical City Clinic — SM City Lipa | Lipa City | Mon–Sun, 8:00 AM – 6:00 PM | (043) 784-0199 | lipa@themedicalcity.com | 1 generic staff label(s): The Medical City Ambulatory Care Team | |
| 12 | `anna-patricia-derma-lipa` | Anna Patricia Dermatology Clinic | Lipa City | Mon–Sat, 9:00 AM – 5:00 PM | +63 961 063 7316 | annapatriciaderma@gmail.com | 1 named doctor(s) with credentials: Dr. Anna Patricia Tan, FPDS<br>uses a free-mail address (gmail/yahoo/...)<br>claims teleconsultation | |
| 13 | `custodio-skin-clinic-lipa` | Custodio's Skin Clinic | Lipa City | Mon–Sat, 8:30 AM – 5:00 PM | (043) 757-4644 | custodioskinclinic@gmail.com | 1 named doctor(s) with credentials: Dr. Jose T. Custodio, MD<br>uses a free-mail address (gmail/yahoo/...) | |
| 14 | `mary-mediatrix-derma` | Mary Mediatrix Medical Center — Dermatology | Lipa City | Mon–Sat, 8:00 AM – 5:00 PM | (043) 773-6800 | info@marymediatrix.com | 1 generic staff label(s): Mary Mediatrix Dermatology Section<br>claims teleconsultation | |
| 15 | `lipa-medix-derma` | Lipa Medix Medical Center — Dermatology Clinic | Lipa City | Mon–Sat, 9:00 AM – 5:00 PM | (043) 756-1190 | derma@lipamedix.com.ph | 1 generic staff label(s): Lipa Medix Dermatology OPD<br>claims teleconsultation | |
| 16 | `ortiz-skin-forum-sto-tomas` | Ortiz Skin Forum — SM City Sto. Tomas | Santo Tomas | Mon–Sun, 10:00 AM – 9:00 PM | (043) 778-9200 | stotomas@ortizskinclinic.com | 1 generic staff label(s): Resident Aesthetic Physician | |
| 17 | `dermacare-sto-tomas` | Dermacare — Sto. Tomas | Santo Tomas | Mon–Sat, 9:00 AM – 6:00 PM | (043) 778-3112 | stotomas@dermacare.ph | 1 generic staff label(s): Resident Clinic Physician | |
| 18 | `st-frances-cabrini-derma` | St. Frances Cabrini Medical Center — Dermatology Clinic | Santo Tomas | Mon–Sat, 8:30 AM – 5:00 PM | (043) 778-4811 | info@cabrini.com.ph | 1 named doctor(s) with credentials: Dr. Veronica Marie San Juan, MD, FPDS<br>claims teleconsultation | |
| 19 | `dermacare-tanauan` | Dermacare — Tanauan | Tanauan City | Mon–Sat, 9:00 AM – 6:00 PM | (043) 778-2041 | tanauan@dermacare.ph | 1 generic staff label(s): Resident Clinic Physician | |
| 20 | `skin-health-tanauan` | Skin Health and Aesthetic Dermatology Clinic — Tanauan | Tanauan City | Mon–Sat, 9:00 AM – 5:00 PM | (043) 778-1299 | skinhealth.tanauan@gmail.com | 1 generic staff label(s): Attending Dermatology Specialist<br>uses a free-mail address (gmail/yahoo/...)<br>claims teleconsultation | |
| 21 | `lynderm-sm-lemery` | Lynderm Facial Center & Day Spa — SM Center Lemery | Lemery | Mon–Sun, 10:00 AM – 9:00 PM | (043) 741-5301 | smlemery@lynderm.ph | 1 generic staff label(s): Resident Aesthetic Doctor | |
| 22 | `our-lady-caysasay-derma` | Our Lady of Caysasay Medical Center — Dermatology Clinic | Lemery | Mon–Sat, 9:00 AM – 5:00 PM | (043) 409-1888 | caysasaymedical@gmail.com | 1 named doctor(s) with credentials: Dr. Florence P. Ruiz, FPDS<br>uses a free-mail address (gmail/yahoo/...)<br>claims teleconsultation | |
| 23 | `bellabeau-skin-bauan` | Bellabeau Skin Care Clinic — Bauan | Bauan | Mon–Sat, 9:00 AM – 6:00 PM | +63 917 187 3262 | bellabeau.bauan@gmail.com | 1 generic staff label(s): Resident Aesthetic Physician<br>uses a free-mail address (gmail/yahoo/...) | |
| 24 | `bauan-doctors-derma` | Bauan Doctors General Hospital — Dermatology Clinic | Bauan | Mon–Fri, 9:00 AM – 4:30 PM | (043) 727-2341 | derma@bauandoctors.com | 1 generic staff label(s): Bauan Doctors Dermatology OPD<br>claims teleconsultation | |
| 25 | `mcwb-balayan-derma` | Medical Center Western Batangas (MCWB) — Dermatology Clinic | Balayan | Mon–Sat, 8:30 AM – 5:00 PM | +63 916 288 8380 | info@mcwb.com.ph | 1 named doctor(s) with credentials: Dr. Krystel Angela Olano, FPDS<br>claims teleconsultation | |
| 26 | `glowbar-nasugbu` | GlowBar Beauty Clinic — Nasugbu | Nasugbu | Tue–Sun, 10:00 AM – 7:00 PM | +63 917 801 3197 | info@glowbarph.com | 1 generic staff label(s): Resident Skincare Consultant<br>claims teleconsultation | |
| 27 | `skin-institute-nasugbu` | The Skin Institute — Nasugbu | Nasugbu | Mon–Sat, 9:00 AM – 5:30 PM | (043) 931-4100 | skininstitute.nasugbu@gmail.com | 1 generic staff label(s): Attending Dermatology Specialist<br>uses a free-mail address (gmail/yahoo/...)<br>claims teleconsultation | |

## Questions for Lemuel
1. Where did the clinic list, hours, phone numbers and emails come from (Google Maps, websites, calls)?
2. Were `rating`, `reviewCount` and `verifiedOnGoogleMaps` copied from a real source, or are they placeholders?
3. Are the named doctors (with FPDS / MD) taken from the clinics' own pages?
4. Which clinics really offer teleconsultation?
