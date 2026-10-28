import mongoose from "mongoose";
import { DoctorProfile, PatientModel, UserModel } from "../../db/schema/index.js";

// Helper to generate an array of YYYY-MM-DD date strings for the requested window
function generateDateRange(days: number): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
}

export async function getAdminDashboardStats(days: number = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
        totalDoctors,
        totalPatients,
        totalAdmitted,
        patientsPerDoctorRaw,
        dateStatsRaw,
        statusDistributionRaw,
        recentPatients,
        recentDoctors,
    ] = await Promise.all([
        // 1. Total active doctors
        DoctorProfile.countDocuments(),

        // 2. Total patients
        PatientModel.countDocuments(),

        // 3. Admitted patients count
        PatientModel.countDocuments({ admit: true }),

        // 4. Clean aggregation: Patients per doctor (top 10)
        PatientModel.aggregate([
            { $unwind: "$doctors" },
            { $group: { _id: "$doctors", patientCount: { $sum: 1 } } },
            {
                $lookup: {
                    from: "doctorprofiles",
                    localField: "_id",
                    foreignField: "_id",
                    as: "doctor",
                },
            },
            { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    doctorId: "$_id",
                    doctorName: { $ifNull: ["$doctor.name", "Unknown Doctor"] },
                    hospital: { $ifNull: ["$doctor.hospital", "General Hospital"] },
                    patientCount: 1,
                    _id: 0,
                },
            },
            { $sort: { patientCount: -1 } },
            { $limit: 10 },
        ]),

        // 5. Optimized aggregation: Date-based statistics over the requested window
        PatientModel.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total: { $sum: 1 },
                    admitted: { $sum: { $cond: ["$admit", 1, 0] } },
                    outpatient: { $sum: { $cond: ["$admit", 0, 1] } },
                },
            },
            { $sort: { _id: 1 } },
        ]),

        // 6. Aggregation: Status distribution
        PatientModel.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { status: "$_id", count: 1, _id: 0 } },
        ]),

        // 7. Recent patients
        PatientModel.find()
            .populate({ path: "doctors", select: "name hospital" })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean(),

        // 8. Recent doctors
        DoctorProfile.find()
            .populate({ path: "userId", select: "email" })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
    ]);

    // Fill continuous dates so timeline chart is smooth
    const dateMap = new Map<string, { total: number; admitted: number; outpatient: number }>();
    dateStatsRaw.forEach((row) => {
        dateMap.set(row._id, {
            total: row.total,
            admitted: row.admitted,
            outpatient: row.outpatient,
        });
    });

    const continuousTimeline = generateDateRange(days).map((date) => {
        const found = dateMap.get(date);
        return {
            date,
            total: found?.total ?? 0,
            admitted: found?.admitted ?? 0,
            outpatient: found?.outpatient ?? 0,
        };
    });

    const avgPatientsPerDoctor =
        totalDoctors > 0 ? Number((totalPatients / totalDoctors).toFixed(1)) : 0;

    return {
        overview: {
            totalDoctors,
            totalPatients,
            totalAdmitted,
            totalOutpatient: Math.max(0, totalPatients - totalAdmitted),
            avgPatientsPerDoctor,
        },
        patientsPerDoctor: patientsPerDoctorRaw,
        dateBasedStats: continuousTimeline,
        statusDistribution: statusDistributionRaw,
        recentPatients,
        recentDoctors,
    };
}

export async function getDoctorDashboardStats(
    userId: mongoose.Types.ObjectId,
    days: number = 30
) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Find or create doctor profile for this user
    let profile = await DoctorProfile.findOne({ userId });
    if (!profile) {
        const user = await UserModel.findById(userId);
        profile = await DoctorProfile.create({
            userId,
            name: user?.name || "Doctor",
            hospital: "General Hospital",
            phone: "",
        });
    }

    const doctorProfileId = profile._id;

    const [
        totalPatients,
        totalAdmitted,
        criticalCount,
        stableCount,
        dateStatsRaw,
        statusDistributionRaw,
        recentPatients,
    ] = await Promise.all([
        // 1. Total patients assigned to this doctor
        PatientModel.countDocuments({ doctors: doctorProfileId }),

        // 2. Admitted count
        PatientModel.countDocuments({ doctors: doctorProfileId, admit: true }),

        // 3. Critical count (very-ill or ill)
        PatientModel.countDocuments({
            doctors: doctorProfileId,
            status: { $in: ["very-ill", "ill"] },
        }),

        // 4. Stable/good count
        PatientModel.countDocuments({
            doctors: doctorProfileId,
            status: { $in: ["stable", "good"] },
        }),

        // 5. Optimized aggregation: Date-based stats for this doctor
        PatientModel.aggregate([
            { $match: { doctors: doctorProfileId, createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    total: { $sum: 1 },
                    admitted: { $sum: { $cond: ["$admit", 1, 0] } },
                    outpatient: { $sum: { $cond: ["$admit", 0, 1] } },
                },
            },
            { $sort: { _id: 1 } },
        ]),

        // 6. Status distribution for this doctor
        PatientModel.aggregate([
            { $match: { doctors: doctorProfileId } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { status: "$_id", count: 1, _id: 0 } },
        ]),

        // 7. Recent patients for this doctor
        PatientModel.find({ doctors: doctorProfileId })
            .sort({ createdAt: -1 })
            .limit(6)
            .lean(),
    ]);

    // Fill continuous timeline
    const dateMap = new Map<string, { total: number; admitted: number; outpatient: number }>();
    dateStatsRaw.forEach((row) => {
        dateMap.set(row._id, {
            total: row.total,
            admitted: row.admitted,
            outpatient: row.outpatient,
        });
    });

    const continuousTimeline = generateDateRange(days).map((date) => {
        const found = dateMap.get(date);
        return {
            date,
            total: found?.total ?? 0,
            admitted: found?.admitted ?? 0,
            outpatient: found?.outpatient ?? 0,
        };
    });

    return {
        doctorProfile: {
            _id: profile._id,
            name: profile.name,
            hospital: profile.hospital,
            phone: profile.phone,
        },
        overview: {
            totalPatients,
            totalAdmitted,
            totalOutpatient: Math.max(0, totalPatients - totalAdmitted),
            criticalCount,
            stableCount,
        },
        dateBasedStats: continuousTimeline,
        statusDistribution: statusDistributionRaw,
        recentPatients,
    };
}

