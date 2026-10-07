import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { adminAccessError } from '@/lib/admin-api-auth';
import { PendingBooking } from '@/models/PendingBooking';
import { emitRealtimeChange } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const denied = await adminAccessError('bookings', 'delete');
    if (denied) return denied;
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid pending booking ID.' }, { status: 400 });
    }
    await connectDB();
    const deleted = await PendingBooking.findByIdAndDelete(id).select('eventId').lean();
    if (!deleted) return NextResponse.json({ success: false, message: 'Pending booking not found.' }, { status: 404 });
    emitRealtimeChange({ resource: 'bookings', action: 'deleted', id: String(deleted.eventId) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/admin/bookings/pending/[id] failed:', error);
    return NextResponse.json({ success: false, message: 'Unable to delete pending booking.' }, { status: 500 });
  }
}
