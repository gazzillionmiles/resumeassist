import { getCollections } from '@/lib/server/db/mongodb';
import { requireUser } from '@/lib/server/auth';
import { toObjectId } from '@/lib/server/db/ids';
import { json, options, handleError } from '@/lib/server/http';

export const runtime = 'nodejs';
export async function OPTIONS() { return options(); }

export async function GET(request) {
  try {
    const userId = requireUser(request);
    const { users } = await getCollections();
    const user = await users.findOne({ _id: toObjectId(userId) });
    if (!user) {
      const error = new Error('user_not_found');
      error.status = 401;
      throw error;
    }

    return json({
      user: {
        id: user._id.toString(),
        email: user.email,
        emailVerified: Boolean(user.emailVerified),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
