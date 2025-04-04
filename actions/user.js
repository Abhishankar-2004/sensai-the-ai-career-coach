"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { generateAIInsights } from "./dashboard";

export async function updateUser(data) {
  if (!data) {
    throw new Error("No data provided for update");
  }

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    // Validate required fields
    if (!data.industry) {
      throw new Error("Industry is required");
    }

    // Start a transaction to handle both operations
    const result = await db.$transaction(
      async (tx) => {
        // First check if industry exists
        let industryInsight = await tx.industryInsight.findUnique({
          where: {
            industry: data.industry,
          },
        });

        // If industry doesn't exist, create it with default values
        if (!industryInsight) {
          const insights = await generateAIInsights(data.industry);

          industryInsight = await db.industryInsight.create({
            data: {
              industry: data.industry,
              ...insights,
              nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
        }

        // Prepare the update data
        const updateData = {
          industry: data.industry,
          experience: data.experience ? parseInt(data.experience) : null,
          bio: data.bio || null,
          skills: data.skills ? (Array.isArray(data.skills) ? data.skills : data.skills.split(',').map(skill => skill.trim()).filter(Boolean)) : [],
        };

        // Now update the user
        const updatedUser = await tx.user.update({
          where: {
            id: user.id,
          },
          data: updateData,
        });

        return { success: true, user: updatedUser };
      },
      {
        timeout: 10000, // default: 5000
      }
    );

    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("Error updating user and industry:", error);
    throw new Error(`Failed to update profile: ${error.message}`);
  }
}

export async function getUserOnboardingStatus() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  try {
    const user = await db.user.findUnique({
      where: {
        clerkUserId: userId,
      },
      select: {
        industry: true,
      },
    });

    return {
      isOnboarded: !!user?.industry,
    };
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    throw new Error("Failed to check onboarding status");
  }
}
