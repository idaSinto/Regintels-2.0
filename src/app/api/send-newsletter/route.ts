import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { fetchUpdates } from '@/lib/fetchUpdates';
import { renderNewsletter } from '@/lib/renderNewsletter';

// ==========================================
// EMAIL DISPATCH HANDLER
// ==========================================
export async function POST() {
  const recipientEmail = process.env.NEWSLETTER_RECIPIENT_EMAIL;
  if (!recipientEmail) {
    return NextResponse.json(
      { status: 'error', message: 'NEWSLETTER_RECIPIENT_EMAIL is not configured.' },
      { status: 500 },
    );
  }

  // 1. Prepare data and generate the HTML email content
  const articles = await fetchUpdates();
  const html = renderNewsletter(articles);

  // 2. Configure the email transport service (Gmail)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    // 3. Attempt to send the email
    await transporter.sendMail({
      from: `"Regintels" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: 'Weekly Regulatory Updates',
      html,
    });

    return NextResponse.json({ status: 'success', message: 'Email sent!' });
  } catch (err) {
    // 4. Handle errors (e.g., authentication failure or network issues)
    console.error(err);
    return NextResponse.json({ status: 'error', message: 'Failed to send email' });
  }
}