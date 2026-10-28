import mongoose from "mongoose";
import * as argon2 from "argon2";
import { env } from "../config/env.js";
import {
    UserModel,
    DoctorProfile,
    DoctorSpecializationModel,
    PatientModel,
} from "./schema/index.js";

async function seed() {
    await mongoose.connect(env.MONGODB_URI);
    console.log("MongoDB connected for seeding");

    // 1. Seed Admin
    let admin = await UserModel.findOne({ email: env.SEED_ADMIN_EMAIL });
    if (!admin) {
        const passwordHash = await argon2.hash(env.SEED_ADMIN_PASSWORD);
        admin = await UserModel.create({
            email: env.SEED_ADMIN_EMAIL,
            passwordHash,
            name: env.SEED_ADMIN_NAME,
            role: "admin",
            isActive: true,
        });
        console.log(`Admin user created: ${env.SEED_ADMIN_EMAIL}`);
    } else {
        console.log(`Admin user already exists: ${env.SEED_ADMIN_EMAIL}`);
    }

    // 2. Seed Specializations
    const specializations = [
        "Cardiology",
        "Neurology",
        "Pediatrics",
        "Orthopedics",
        "Dermatology",
        "General Medicine",
    ];
    const specDocs = await Promise.all(
        specializations.map(async (name) => {
            return DoctorSpecializationModel.findOneAndUpdate(
                { name },
                { name },
                { upsert: true, new: true }
            );
        })
    );

    // 3. Seed Demo Doctor
    const demoDoctorEmail = "doctor@test.com";
    let demoDoctorUser = await UserModel.findOne({ email: demoDoctorEmail });
    if (!demoDoctorUser) {
        const passwordHash = await argon2.hash("DoctorPass123!");
        demoDoctorUser = await UserModel.create({
            email: demoDoctorEmail,
            passwordHash,
            name: "Dr. Gregory House",
            role: "doctor",
            isActive: true,
        });
        console.log(`Demo doctor user created: ${demoDoctorEmail}`);
    }

    let demoDoctorProfile = await DoctorProfile.findOne({ userId: demoDoctorUser._id });
    if (!demoDoctorProfile) {
        demoDoctorProfile = await DoctorProfile.create({
            userId: demoDoctorUser._id,
            name: "Dr. Gregory House",
            hospital: "Princeton-Plainsboro Teaching Hospital",
            phone: "+1 (555) 019-2831",
            specialization: [specDocs[5]._id, specDocs[1]._id],
        });
        console.log("Demo doctor profile created");
    }

    // 4. Seed Additional Doctors
    const extraDoctors = [
        {
            name: "Dr. Sarah Jenkins",
            email: "sarah.jenkins@hospital.org",
            hospital: "St. Jude Medical Center",
            phone: "+1 (555) 014-9982",
            specIndex: 0, // Cardiology
        },
        {
            name: "Dr. Robert Chen",
            email: "robert.chen@hospital.org",
            hospital: "Metropolitan General Hospital",
            phone: "+1 (555) 017-3341",
            specIndex: 2, // Pediatrics
        },
        {
            name: "Dr. Emily Davis",
            email: "emily.davis@hospital.org",
            hospital: "City Orthopedic Clinic",
            phone: "+1 (555) 012-7719",
            specIndex: 3, // Orthopedics
        },
    ];

    const seededDoctorProfiles = [demoDoctorProfile];

    for (const d of extraDoctors) {
        let user = await UserModel.findOne({ email: d.email });
        if (!user) {
            const passwordHash = await argon2.hash("DoctorPass123!");
            user = await UserModel.create({
                name: d.name,
                email: d.email,
                passwordHash,
                role: "doctor",
                isActive: true,
            });
        }
        let profile = await DoctorProfile.findOne({ userId: user._id });
        if (!profile) {
            profile = await DoctorProfile.create({
                userId: user._id,
                name: d.name,
                hospital: d.hospital,
                phone: d.phone,
                specialization: [specDocs[d.specIndex]._id],
            });
        }
        seededDoctorProfiles.push(profile);
    }

    // 5. Seed Patients with staggered creation dates for realistic charts
    const existingPatientsCount = await PatientModel.countDocuments();
    if (existingPatientsCount < 10) {
        const samplePatients = [
            {
                name: "James Wilson",
                status: "ill" as const,
                admit: true,
                gender: "male" as const,
                age: 42,
                description: "Severe respiratory distress with lingering fever.",
                doctorIndex: 0,
                daysAgo: 1,
            },
            {
                name: "Lisa Cuddy",
                status: "stable" as const,
                admit: false,
                gender: "female" as const,
                age: 38,
                description: "Routine post-op follow up and vitals check.",
                doctorIndex: 0,
                daysAgo: 2,
            },
            {
                name: "Allison Cameron",
                status: "good" as const,
                admit: false,
                gender: "female" as const,
                age: 29,
                description: "Seasonal allergy evaluation, prescribed antihistamines.",
                doctorIndex: 0,
                daysAgo: 4,
            },
            {
                name: "Robert Chase",
                status: "very-ill" as const,
                admit: true,
                gender: "male" as const,
                age: 34,
                description: "Acute appendicitis observation in ICU ward 3.",
                doctorIndex: 0,
                daysAgo: 5,
            },
            {
                name: "Michael Adams",
                status: "stable" as const,
                admit: false,
                gender: "male" as const,
                age: 51,
                description: "Hypertension monitoring and medication adjustment.",
                doctorIndex: 1,
                daysAgo: 3,
            },
            {
                name: "Sophia Martinez",
                status: "ill" as const,
                admit: true,
                gender: "female" as const,
                age: 8,
                description: "High-grade fever with mild dehydration, on IV fluids.",
                doctorIndex: 2,
                daysAgo: 6,
            },
            {
                name: "David Kim",
                status: "good" as const,
                admit: false,
                gender: "male" as const,
                age: 24,
                description: "Knee arthroscopy rehabilitation consultation.",
                doctorIndex: 3,
                daysAgo: 7,
            },
            {
                name: "Emma Watson",
                status: "stable" as const,
                admit: true,
                gender: "female" as const,
                age: 63,
                description: "Post-cardiac catheterization recovery and telemetry monitoring.",
                doctorIndex: 1,
                daysAgo: 8,
            },
            {
                name: "Oliver Brown",
                status: "very-ill" as const,
                admit: true,
                gender: "male" as const,
                age: 70,
                description: "Congestive heart failure flare, requiring close observation.",
                doctorIndex: 0,
                daysAgo: 10,
            },
            {
                name: "Grace Taylor",
                status: "good" as const,
                admit: false,
                gender: "female" as const,
                age: 19,
                description: "General health screening for collegiate athletics.",
                doctorIndex: 2,
                daysAgo: 12,
            },
        ];

        for (const p of samplePatients) {
            const createdAt = new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000);
            const docProfile = seededDoctorProfiles[p.doctorIndex] || seededDoctorProfiles[0];
            await PatientModel.create({
                name: p.name,
                status: p.status,
                admit: p.admit,
                gender: p.gender,
                age: p.age,
                description: p.description,
                doctors: [docProfile._id],
                createdAt,
                updatedAt: createdAt,
            });
        }
        console.log("Sample patients seeded with historical dates");
    }

    await mongoose.disconnect();
    console.log("Seeding complete");
}

seed().catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
});
