import { UserEditor } from "@/components/user/user-editor";
import type { UserResponse } from "@/lib/api/generated/model";
import { getCurrentUser } from "@/lib/api/generated/endpoints/auth/auth";
import { listUsers } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [userResponse, meResponse] = await Promise.all([
    listUsers({
      page: 0,
      size: 1000,
      sort: ["firstName"],
    }),
    getCurrentUser(),
  ]);
  const users: UserResponse[] =
    userResponse.status === 200 ? (userResponse.data.content ?? []) : [];
  const currentUserId =
    meResponse.status === 200 ? meResponse.data.id : undefined;

  return <UserEditor initialUsers={users} currentUserId={currentUserId} />;
}
