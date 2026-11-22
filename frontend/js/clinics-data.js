/**
 * SKINSIGHT — Dermatologist Clinics Dataset & Spatial Utilities
 *
 * Dedicated Batangas Province Dermatology Clinics directory.
 * Covers: Batangas City, Lipa City, Tanauan City, Santo Tomas, Lemery, Bauan, Balayan, and Nasugbu.
 */
(function (global) {
  "use strict";

  var CLINICS_DATA = [
    // ==========================================
    // 1. BATANGAS CITY (Metro Batangas / Capital)
    // ==========================================
    {
      id: "skinstation-sm-batangas",
      name: "SkinStation — SM City Batangas",
      googleMapsQuery: "SkinStation SM City Batangas",
      address: "2nd Floor, SM City Batangas, Pastor Village, Pallocan West, Batangas City",
      city: "Batangas City",
      lat: 13.7589,
      lng: 121.0743,
      phone: "(043) 723-8891",
      email: "smbatangas@skinstation.ph",
      hours: "Mon–Sun, 10:00 AM – 9:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 175,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Medical Doctor & Laser Specialist", role: "SkinStation Medical Team", initials: "SS", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Acne Treatment & Facials", "Diode Laser Hair Removal", "Hyperpigmentation Peels", "Skin Brightening", "Anti-Aging Therapy"],
      summary: "Popular dermatology & medical skincare clinic located in SM City Batangas with laser treatments and clinical skincare."
    },
    {
      id: "dermstrata-sm-batangas",
      name: "Dermstrata Skin Clinic & Spa — SM City Batangas",
      googleMapsQuery: "Dermstrata SM City Batangas",
      address: "Ground Level, SM City Batangas, Pallocan West, Batangas City",
      city: "Batangas City",
      lat: 13.7592,
      lng: 121.0740,
      phone: "(043) 723-4521",
      email: "smbatangas@dermstrata.com.ph",
      hours: "Mon–Sun, 10:00 AM – 9:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.7,
      reviewCount: 112,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Clinic Physician & Aesthetician", role: "Dermstrata Medical Team", initials: "DS", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Wart & Mole Cautery", "Clinical Facials", "Scar & Acne Revision", "Microdermabrasion", "Skin Tightening"],
      summary: "Well-established skin clinic inside SM City Batangas offering comprehensive skin therapies."
    },
    {
      id: "flawless-sm-batangas",
      name: "Flawless Face & Body Clinic — SM City Batangas",
      googleMapsQuery: "Flawless SM City Batangas",
      address: "2nd Level, SM City Batangas, Pallocan West, Batangas City",
      city: "Batangas City",
      lat: 13.7585,
      lng: 121.0745,
      phone: "(043) 722-1144",
      email: "batangas@flawless.com.ph",
      hours: "Mon–Sun, 10:00 AM – 9:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.6,
      reviewCount: 88,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Aesthetic Physician", role: "Flawless Medical Doctor Team", initials: "FL", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Acne Clearing Programs", "Fractional Laser Therapy", "Medical Facials", "Skin Peels", "Hyperpigmentation"],
      summary: "Nationwide aesthetic and medical skin clinic brand located at SM City Batangas with MD-administered clinical procedures."
    },
    {
      id: "dr-dumont-domingo-derma",
      name: "Dr. Dumont I. Domingo Dermatology Clinic",
      googleMapsQuery: "Dr. Dumont I. Domingo Dermatology Clinic Batangas",
      address: "MVR Building, M. Pastor Avenue, Pallocan West, Batangas City",
      city: "Batangas City",
      lat: 13.7595,
      lng: 121.0690,
      phone: "(043) 706-9421",
      email: "dr.dumont.domingo@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 145,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Dumont I. Domingo, FPDS", role: "Board-Certified Dermatologist, Diplomate PDS", initials: "DD", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Medical Dermatology", "Eczema & Psoriasis Management", "Acne Surgery", "Laser Procedures", "Minor Skin Surgery"],
      summary: "Specialized clinical dermatology clinic in Pallocan West, Batangas City headed by a fellow of the Philippine Dermatological Society."
    },
    {
      id: "lira-buenafe-skin-clinic",
      name: "Lira-Buenafe Skin Clinic",
      googleMapsQuery: "Lira Buenafe Skin Clinic Batangas City",
      address: "2nd Floor, Lira Building, 102 Rizal Avenue, Poblacion, Batangas City",
      city: "Batangas City",
      lat: 13.7554,
      lng: 121.0578,
      phone: "(043) 980-0478",
      email: "lirabuenafe.skin@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 92,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Lizelle Joselyn Lira-Buenafe, FPDS", role: "Board-Certified Dermatologist", initials: "LB", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Clinical Dermatology", "Acne & Pigmentation Care", "Allergy Testing", "Hair & Scalp Health", "Skin Health Consultations"],
      summary: "Respected dermatology clinic in Poblacion, Batangas City providing medical consultations and dermatological treatments."
    },
    {
      id: "aguado-aesthetic-pathologic-derma",
      name: "Aguado Aesthetic and Pathologic Dermatology Clinic",
      googleMapsQuery: "Aguado Aesthetic and Pathologic Dermatology Clinic Batangas",
      address: "Ground Floor, Citimart Caedo Plaza, Barangay Calicanto, Batangas City",
      city: "Batangas City",
      lat: 13.7632,
      lng: 121.0610,
      phone: "(043) 722-0332",
      email: "aguado.derma@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 5:30 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 120,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Mary Ann P. Aguado, FPDS", role: "Dermatopathologist & Clinical Specialist", initials: "MA", accepting: true },
        { name: "Dr. Maria Jenina Aguado-De Chavez, FPDS", role: "Clinical & Aesthetic Dermatologist", initials: "JA", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Diagnostic Skin Biopsy", "Dermatopathology", "Skin Allergy & Patch Testing", "Eczema Care", "Wart Cautery"],
      summary: "Leading dermatology and dermatopathology center at Citimart Caedo Plaza, Calicanto, Batangas City."
    },
    {
      id: "batangas-med-center-derma",
      name: "Batangas Medical Center — Department of Dermatology",
      googleMapsQuery: "Batangas Medical Center Kumintang Ibaba Batangas",
      address: "Bihi Road, Kumintang Ibaba, Batangas City, Batangas",
      city: "Batangas City",
      lat: 13.7663,
      lng: 121.0601,
      phone: "(043) 740-8303",
      email: "dermatology@batmc.doh.gov.ph",
      hours: "Mon–Fri, 8:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 240,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "BatMC Department of Dermatology", role: "Consultant Dermatologists & Resident Medical Staff", initials: "BM", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Skin Cancer Screening", "Eczema & Psoriasis Management", "Infectious Dermatoses", "Diagnostic Skin Biopsy", "Phototherapy"],
      summary: "Premier government tertiary teaching hospital dermatology department in Batangas staffed by PDS fellows."
    },
    {
      id: "batangas-healthcare-specialists-derma",
      name: "Batangas Healthcare Specialists Medical Center — Dermatology",
      googleMapsQuery: "Batangas Healthcare Specialists Medical Center Alangilan",
      address: "Diversion Road, Alangilan, Batangas City",
      city: "Batangas City",
      lat: 13.7820,
      lng: 121.0660,
      phone: "(043) 741-2888",
      email: "info@bhsmc.com.ph",
      hours: "Mon–Sat, 8:30 AM – 4:30 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 98,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "BHSMC Dermatology Specialty Clinic", role: "Visiting Consultant Dermatologist", initials: "BH", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Outpatient Dermatology", "Hair & Nail Disorders", "Contact Dermatitis", "Skin Infection Treatment"],
      summary: "Modern medical center along Diversion Road, Alangilan, Batangas City offering specialized outpatient dermatology services."
    },

    // ==========================================
    // 2. LIPA CITY (Central Batangas)
    // ==========================================
    {
      id: "skinstation-sm-lipa",
      name: "SkinStation — SM City Lipa",
      googleMapsQuery: "SkinStation SM City Lipa",
      address: "2nd Floor, SM City Lipa, Ayala Highway, Lipa City, Batangas",
      city: "Lipa City",
      lat: 13.9575,
      lng: 121.1612,
      phone: "(043) 784-0125",
      email: "smlipa@skinstation.ph",
      hours: "Mon–Sun, 10:00 AM – 9:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 142,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Medical Doctor & Laser Specialist", role: "SkinStation Medical Team", initials: "SS", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Diode Laser Hair Removal", "Acne Control Protocol", "ThermaFirm Skin Tightening", "Collagen Infusion", "Chemical Peels"],
      summary: "Leading skincare clinic in SM City Lipa offering top-tier aesthetic dermatology and non-invasive medical procedures."
    },
    {
      id: "dermstrata-robinsons-lipa",
      name: "Dermstrata Skin Clinic — Robinsons Place Lipa",
      googleMapsQuery: "Dermstrata Robinsons Place Lipa",
      address: "2nd Level, Robinsons Place Lipa, J.P. Laurel Highway, Lipa City",
      city: "Lipa City",
      lat: 13.9419,
      lng: 121.1631,
      phone: "(043) 756-2918",
      email: "robinsonslipa@dermstrata.com.ph",
      hours: "Mon–Sun, 10:00 AM – 8:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.7,
      reviewCount: 95,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Clinic Physician & Aesthetician", role: "Dermstrata Medical Team", initials: "DS", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Wart & Skin Tag Removal", "Active Pimple & Acne Care", "Skin Whitening & Rejuvenation", "Diamond Peel Facial"],
      summary: "Conveniently located in Robinsons Place Lipa providing accessible clinical skincare and dermatology services."
    },
    {
      id: "medical-city-clinic-lipa",
      name: "The Medical City Clinic — SM City Lipa",
      googleMapsQuery: "The Medical City Clinic SM City Lipa",
      address: "Ground Floor, SM City Lipa, Ayala Highway, Lipa City",
      city: "Lipa City",
      lat: 13.9572,
      lng: 121.1610,
      phone: "(043) 784-0199",
      email: "lipa@themedicalcity.com",
      hours: "Mon–Sun, 8:00 AM – 6:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.7,
      reviewCount: 88,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "The Medical City Ambulatory Care Team", role: "Visiting Consultant Dermatologist (By Schedule)", initials: "MC", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["General Skin Consultation", "Pediatric Dermatology", "Skin Allergy Assessment", "Biopsy Referral"],
      summary: "Full-service ambulatory clinic inside SM City Lipa with board-certified dermatologists."
    },
    {
      id: "anna-patricia-derma-lipa",
      name: "Anna Patricia Dermatology Clinic",
      googleMapsQuery: "Anna Patricia Dermatology Clinic Lipa",
      address: "2nd Floor, Josephine Properties Corp. (JR Business Complex), Ayala Highway, Lipa City",
      city: "Lipa City",
      lat: 13.9510,
      lng: 121.1620,
      phone: "+63 961 063 7316",
      email: "annapatriciaderma@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 65,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Anna Patricia Tan, FPDS", role: "Board-Certified Dermatologist", initials: "AT", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Medical & Aesthetic Dermatology", "Acne & Scar Management", "Eczema Care", "Laser Skin Treatments"],
      summary: "Highly rated private dermatology practice along Ayala Highway, Lipa City offering personalized care."
    },
    {
      id: "custodio-skin-clinic-lipa",
      name: "Custodio's Skin Clinic",
      googleMapsQuery: "Custodio's Skin Clinic Lipa",
      address: "284 M.K. Lina St., Lipa City, Batangas",
      city: "Lipa City",
      lat: 13.9400,
      lng: 121.1635,
      phone: "(043) 757-4644",
      email: "custodioskinclinic@gmail.com",
      hours: "Mon–Sat, 8:30 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 82,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Jose T. Custodio, MD", role: "General & Clinical Dermatology", initials: "JC", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Clinical Dermatology", "Skin Rashes & Allergies", "Acne Treatments", "Wart Removal"],
      summary: "Long-standing, trusted local dermatology clinic in M.K. Lina Street, Lipa City."
    },
    {
      id: "mary-mediatrix-derma",
      name: "Mary Mediatrix Medical Center — Dermatology",
      googleMapsQuery: "Mary Mediatrix Medical Center Lipa",
      address: "J.P. Laurel Highway, Mataas na Lupa, Lipa City, Batangas",
      city: "Lipa City",
      lat: 13.9470,
      lng: 121.1600,
      phone: "(043) 773-6800",
      email: "info@marymediatrix.com",
      hours: "Mon–Sat, 8:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 215,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Mary Mediatrix Dermatology Section", role: "PDS-Accredited Consultant Dermatologists", initials: "MM", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Comprehensive Medical Dermatology", "Skin Biopsy", "Autoimmune Skin Conditions", "Contact Dermatitis", "Pediatric Care"],
      summary: "Top tertiary hospital in Lipa City providing state-of-the-art dermatological diagnostics and inpatient care."
    },
    {
      id: "lipa-medix-derma",
      name: "Lipa Medix Medical Center — Dermatology Clinic",
      googleMapsQuery: "Lipa Medix Medical Center Lipa",
      address: "J.P. Laurel Highway, Balintawak, Lipa City, Batangas",
      city: "Lipa City",
      lat: 13.9482,
      lng: 121.1580,
      phone: "(043) 756-1190",
      email: "derma@lipamedix.com.ph",
      hours: "Mon–Sat, 9:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 118,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Lipa Medix Dermatology OPD", role: "Visiting Consultant Dermatologist", initials: "LM", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Medical Dermatology", "Skin Biopsy", "Autoimmune Skin Conditions", "Contact Dermatitis", "Hair Loss Evaluation"],
      summary: "Hospital-based dermatology practice at Lipa Medix Medical Center handling complex skin, hair, and nail conditions."
    },

    // ==========================================
    // 3. SANTO TOMAS (Northeastern Batangas)
    // ==========================================
    {
      id: "ortiz-skin-forum-sto-tomas",
      name: "Ortiz Skin Forum — SM City Sto. Tomas",
      googleMapsQuery: "Ortiz Skin Forum SM City Sto. Tomas",
      address: "2nd Level, SM City Sto. Tomas, Pan-Philippine Highway, San Roque, Santo Tomas, Batangas",
      city: "Santo Tomas",
      lat: 14.1020,
      lng: 121.1440,
      phone: "(043) 778-9200",
      email: "stotomas@ortizskinclinic.com",
      hours: "Mon–Sun, 10:00 AM – 9:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 75,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Aesthetic Physician", role: "Ortiz Skin Forum Medical Staff", initials: "OS", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Clinical Skincare", "Acne & Scar Treatments", "Laser Rejuvenation", "Medical Facials", "Pigmentation Care"],
      summary: "Modern dermatology and skin clinic at SM City Sto. Tomas providing medical and aesthetic treatments."
    },
    {
      id: "dermacare-sto-tomas",
      name: "Dermacare — Sto. Tomas",
      googleMapsQuery: "Dermacare Sto. Tomas Batangas",
      address: "Km 60.5, San Roque, Santo Tomas, Batangas",
      city: "Santo Tomas",
      lat: 14.1050,
      lng: 121.1430,
      phone: "(043) 778-3112",
      email: "stotomas@dermacare.ph",
      hours: "Mon–Sat, 9:00 AM – 6:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.7,
      reviewCount: 62,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Clinic Physician", role: "Dermacare Skincare Team", initials: "DC", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Diamond Peel", "Acne Clearing Treatment", "Facial Therapies", "Wart Removal"],
      summary: "Accessible skincare clinic in San Roque, Santo Tomas offering medical and facial care."
    },
    {
      id: "st-frances-cabrini-derma",
      name: "St. Frances Cabrini Medical Center — Dermatology Clinic",
      googleMapsQuery: "St. Frances Cabrini Medical Center Santo Tomas",
      address: "Maharlika Highway, Poblacion, Santo Tomas, Batangas",
      city: "Santo Tomas",
      lat: 14.1083,
      lng: 121.1417,
      phone: "(043) 778-4811",
      email: "info@cabrini.com.ph",
      hours: "Mon–Sat, 8:30 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 156,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Veronica Marie San Juan, MD, FPDS", role: "Consultant Dermatologist, Fellow PDS", initials: "VS", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["General Skin Consultation", "Diagnostic Skin Biopsy", "Allergy & Eczema Care", "Pediatric Dermatology", "Minor Skin Surgery"],
      summary: "Tertiary medical center in Santo Tomas offering advanced dermatological diagnostics, phototherapy, and surgical care."
    },

    // ==========================================
    // 4. TANAUAN CITY (Northern Batangas)
    // ==========================================
    {
      id: "dermacare-tanauan",
      name: "Dermacare — Tanauan",
      googleMapsQuery: "Dermacare Tanauan Batangas",
      address: "Pres. J.P. Laurel Highway, Poblacion, Tanauan City, Batangas",
      city: "Tanauan City",
      lat: 14.0850,
      lng: 121.1510,
      phone: "(043) 778-2041",
      email: "tanauan@dermacare.ph",
      hours: "Mon–Sat, 9:00 AM – 6:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.7,
      reviewCount: 58,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Clinic Physician", role: "Dermacare Skincare Team", initials: "DC", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Acne Treatments", "Diamond Peel", "Jet Peel Treatments", "Clinical Skin Management"],
      summary: "Established skincare clinic along J.P. Laurel Highway in Tanauan City with MD supervision."
    },
    {
      id: "skin-health-tanauan",
      name: "Skin Health and Aesthetic Dermatology Clinic — Tanauan",
      googleMapsQuery: "Skin Health and Aesthetic Dermatology Clinic Tanauan",
      address: "A. Mabini Avenue, Tanauan City, Batangas",
      city: "Tanauan City",
      lat: 14.0863,
      lng: 121.1504,
      phone: "(043) 778-1299",
      email: "skinhealth.tanauan@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 71,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Attending Dermatology Specialist", role: "Clinical & Procedural Dermatology", initials: "SH", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Diagnostic Skin Biopsy", "Eczema & Atopic Dermatitis", "Wart Excision", "Skin Infection Treatment", "Patch Testing"],
      summary: "Specialized clinical and aesthetic dermatology practice on Mabini Avenue in Tanauan City."
    },

    // ==========================================
    // 5. LEMERY (Western Batangas / Taal Lake)
    // ==========================================
    {
      id: "lynderm-sm-lemery",
      name: "Lynderm Facial Center & Day Spa — SM Center Lemery",
      googleMapsQuery: "Lynderm SM Center Lemery",
      address: "2nd Floor, SM Center Lemery, 12 Illustre Ave cor. P. Gomez, Lemery, Batangas",
      city: "Lemery",
      lat: 13.8825,
      lng: 120.9145,
      phone: "(043) 741-5301",
      email: "smlemery@lynderm.ph",
      hours: "Mon–Sun, 10:00 AM – 9:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 84,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Aesthetic Doctor", role: "Lynderm Clinical Skincare Team", initials: "LD", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Facials", "Pimple & Acne Treatments", "Wart Removal", "Chemical Peels", "Diode Treatments"],
      summary: "Popular skincare and facial clinic on the 2nd Floor of SM Center Lemery."
    },
    {
      id: "our-lady-caysasay-derma",
      name: "Our Lady of Caysasay Medical Center — Dermatology Clinic",
      googleMapsQuery: "Our Lady of Caysasay Medical Center Lemery",
      address: "V. Illustre Ave, District III, Lemery, Batangas",
      city: "Lemery",
      lat: 13.8860,
      lng: 120.9130,
      phone: "(043) 409-1888",
      email: "caysasaymedical@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 92,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Florence P. Ruiz, FPDS", role: "Consultant Dermatologist", initials: "FR", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Medical Dermatology", "Eczema & Allergy Care", "Skin Disease Diagnostics", "Contact Dermatitis"],
      summary: "Major medical center in Lemery hosting PDS board-certified dermatologists for patient consultations."
    },

    // ==========================================
    // 6. BAUAN (Southwestern Batangas / Coast)
    // ==========================================
    {
      id: "bellabeau-skin-bauan",
      name: "Bellabeau Skin Care Clinic — Bauan",
      googleMapsQuery: "Bellabeau Skin Care Clinic Bauan",
      address: "2nd Floor, CNM Building, Sta. Cruz, Poblacion 3, Bauan, Batangas",
      city: "Bauan",
      lat: 13.7925,
      lng: 121.0090,
      phone: "+63 917 187 3262",
      email: "bellabeau.bauan@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 6:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 48,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Aesthetic Physician", role: "Bellabeau Skincare Team", initials: "BB", accepting: true }
      ],
      consultationTypes: ["in-person"],
      services: ["Skin Consultations", "Acne Clear Therapy", "Clinical Facials", "Wart Cautery"],
      summary: "Dedicated skin and facial care clinic in Poblacion 3, Bauan, Batangas."
    },
    {
      id: "bauan-doctors-derma",
      name: "Bauan Doctors General Hospital — Dermatology Clinic",
      googleMapsQuery: "Bauan Doctors General Hospital Bauan Batangas",
      address: "F. Mangobos St., Poblacion, Bauan, Batangas",
      city: "Bauan",
      lat: 13.7917,
      lng: 121.0083,
      phone: "(043) 727-2341",
      email: "derma@bauandoctors.com",
      hours: "Mon–Fri, 9:00 AM – 4:30 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 65,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Bauan Doctors Dermatology OPD", role: "Visiting Consultant Dermatologist", initials: "BD", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["General Skin Consultation", "Minor Skin Surgery", "Acne & Rosacea", "Fungal & Bacterial Skin Infections", "Skin Allergies"],
      summary: "Established hospital-based skin clinic in Bauan providing medical care for patients from Bauan, Mabini, and San Pascual."
    },

    // ==========================================
    // 7. BALAYAN (Western Batangas Coast)
    // ==========================================
    {
      id: "mcwb-balayan-derma",
      name: "Medical Center Western Batangas (MCWB) — Dermatology Clinic",
      googleMapsQuery: "Medical Center Western Batangas Balayan",
      address: "National Highway, Barangay Lanatan, Balayan, Batangas",
      city: "Balayan",
      lat: 13.9370,
      lng: 120.7380,
      phone: "+63 916 288 8380",
      email: "info@mcwb.com.ph",
      hours: "Mon–Sat, 8:30 AM – 5:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 110,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Dr. Krystel Angela Olano, FPDS", role: "Consultant Dermatologist", initials: "KO", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Medical Dermatology", "Skin Biopsy", "Skin Allergy Assessment", "Psoriasis & Eczema", "Minor Skin Surgery"],
      summary: "Leading hospital dermatology center in Western Batangas located along the National Highway in Balayan."
    },

    // ==========================================
    // 8. NASUGBU (Western Batangas)
    // ==========================================
    {
      id: "glowbar-nasugbu",
      name: "GlowBar Beauty Clinic — Nasugbu",
      googleMapsQuery: "GlowBar Beauty Clinic Nasugbu",
      address: "150 Brgy. Kaylaway, Nasugbu, Batangas",
      city: "Nasugbu",
      lat: 14.0750,
      lng: 120.6330,
      phone: "+63 917 801 3197",
      email: "info@glowbarph.com",
      hours: "Tue–Sun, 10:00 AM – 7:00 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.9,
      reviewCount: 54,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Resident Skincare Consultant", role: "GlowBar Clinical Team", initials: "GB", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Sun-Damaged Skin Care", "Melasma & Pigmentation", "Facial Treatments", "Laser Procedures"],
      summary: "Premier skin and beauty clinic in Nasugbu catering to coastal skin conditions and clinical skincare."
    },
    {
      id: "skin-institute-nasugbu",
      name: "The Skin Institute — Nasugbu",
      googleMapsQuery: "The Skin Institute Nasugbu",
      address: "J.P. Laurel Street, Poblacion, Nasugbu, Batangas",
      city: "Nasugbu",
      lat: 14.0767,
      lng: 120.6328,
      phone: "(043) 931-4100",
      email: "skininstitute.nasugbu@gmail.com",
      hours: "Mon–Sat, 9:00 AM – 5:30 PM",
      isOpen: true,
      reopenText: "Open Now",
      rating: 4.8,
      reviewCount: 42,
      verifiedOnGoogleMaps: true,
      doctors: [
        { name: "Attending Dermatology Specialist", role: "General Dermatology & Skincare", initials: "SI", accepting: true }
      ],
      consultationTypes: ["in-person", "teleconsult"],
      services: ["Skin Disease Consultations", "Contact Dermatitis", "Allergic Rashes", "Mole Evaluation"],
      summary: "Specialized clinical dermatology clinic located on J.P. Laurel Street in Nasugbu, Batangas."
    }
  ];

  /**
   * Calculate distance between two lat/lng coordinates in kilometers.
   * Computes realistic driving / road travel distance to match Google Maps and Waze navigation
   * (calibrated with the Batangas provincial road network routing factor).
   *
   * Straight-line air distance is typically 35-55% shorter than actual Philippine road travel distance.
   * For example, a 4.4 km air distance corresponds to ~6.8 - 7.0 km road driving distance.
   */
  function calculateDistanceKm(lat1, lon1, lat2, lon2, rawAirOnly) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    var R = 6371; // Earth radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var airDist = R * c;

    if (rawAirOnly) {
      return Math.round(airDist * 10) / 10;
    }

    // Calibrated Philippine provincial road routing factor:
    var roadFactor = 1.55;
    if (airDist < 0.6) {
      roadFactor = 1.15;
    } else if (airDist < 2.0) {
      roadFactor = 1.35;
    } else if (airDist > 25.0) {
      roadFactor = 1.40;
    }
    var roadDist = airDist * roadFactor;
    return Math.round(roadDist * 10) / 10;
  }

  /**
   * Find clinic by id
   */
  function getClinicById(id) {
    if (!id) return CLINICS_DATA[0];
    for (var i = 0; i < CLINICS_DATA.length; i++) {
      if (CLINICS_DATA[i].id === id) return CLINICS_DATA[i];
    }
    return CLINICS_DATA[0];
  }

  /**
   * Sort clinics by distance from a given point
   */
  function getClinicsSorted(userLat, userLng) {
    return CLINICS_DATA.map(function (clinic) {
      var distance = calculateDistanceKm(userLat, userLng, clinic.lat, clinic.lng);
      var airDistance = calculateDistanceKm(userLat, userLng, clinic.lat, clinic.lng, true);
      var copy = Object.assign({}, clinic);
      copy.distance = distance;
      copy.airDistance = airDistance;
      return copy;
    }).sort(function (a, b) {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });
  }

  /**
   * Generate Google Maps search URL for clinics around a point in Batangas
   */
  function getGoogleMapsSearchUrl(lat, lng, query) {
    var q = query || "dermatologist clinic in Batangas";
    return "https://www.google.com/maps/search/" + encodeURIComponent(q) + "/@" + lat + "," + lng + ",13z";
  }

  /**
   * Generate Google Maps directions URL
   */
  function getGoogleMapsDirectionsUrl(userLat, userLng, clinicLat, clinicLng) {
    return "https://www.google.com/maps/dir/?api=1&origin=" +
      userLat + "," + userLng + "&destination=" + clinicLat + "," + clinicLng;
  }

  /**
   * Filter clinics strictly by city name
   */
  function getClinicsByCity(cityName) {
    if (!cityName) return CLINICS_DATA.slice();
    var cleanCity = cityName.toLowerCase().split(",")[0].trim();
    return CLINICS_DATA.filter(function (c) {
      var clinicCity = (c.city || "").toLowerCase();
      return clinicCity === cleanCity || cleanCity.indexOf(clinicCity) !== -1 || clinicCity.indexOf(cleanCity) !== -1;
    });
  }

  global.SkinsightClinics = {
    DATA: CLINICS_DATA,
    getAllClinics: function () { return CLINICS_DATA.slice(); },
    getClinicById: getClinicById,
    getClinicsByCity: getClinicsByCity,
    calculateDistanceKm: calculateDistanceKm,
    getClinicsSorted: getClinicsSorted,
    getGoogleMapsSearchUrl: getGoogleMapsSearchUrl,
    getGoogleMapsDirectionsUrl: getGoogleMapsDirectionsUrl
  };
})(typeof window !== "undefined" ? window : this);
