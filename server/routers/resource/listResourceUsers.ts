import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "@server/db";
import { userResources, users } from "@server/db/schemas"; // Assuming these are the correct tables
import { eq } from "drizzle-orm";
import response from "@server/lib/response";
import HttpCode from "@server/types/HttpCode";
import createHttpError from "http-errors";
import logger from "@server/logger";
import { fromError } from "zod-validation-error";

const listResourceUsersSchema = z
    .object({
        resourceId: z
            .string()
            .transform(Number)
            .pipe(z.number().int().positive())
    })
    .strict();

async function queryUsers(resourceId: number) {
    return await db
        .select({
            userId: userResources.userId,
            email: users.email
        })
        .from(userResources)
        .innerJoin(users, eq(userResources.userId, users.userId))
        .where(eq(userResources.resourceId, resourceId));
}

export type ListResourceUsersResponse = {
    users: NonNullable<Awaited<ReturnType<typeof queryUsers>>>;
};

export async function listResourceUsers(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> {
    try {
        const parsedParams = listResourceUsersSchema.safeParse(req.params);
        if (!parsedParams.success) {
            return next(
                createHttpError(
                    HttpCode.BAD_REQUEST,
                    fromError(parsedParams.error).toString()
                )
            );
        }

        const { resourceId } = parsedParams.data;

        const resourceUsersList = await queryUsers(resourceId);

        return response<ListResourceUsersResponse>(res, {
            data: {
                users: resourceUsersList
            },
            success: true,
            error: false,
            message: "Resource users retrieved successfully",
            status: HttpCode.OK
        });
    } catch (error) {
        logger.error(error);
        return next(
            createHttpError(HttpCode.INTERNAL_SERVER_ERROR, "An error occurred")
        );
    }
}
