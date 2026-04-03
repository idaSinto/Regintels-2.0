import { NextResponse } from 'next/server';

export async function PATCH() {
  return NextResponse.json(
    { error: 'Direct staff account editing by id is no longer available.' },
    { status: 405 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Direct staff account deletion by id is no longer available.' },
    { status: 405 },
  );
}
