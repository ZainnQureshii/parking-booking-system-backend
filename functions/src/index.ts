import * as functions from "firebase-functions";
import * as admin from 'firebase-admin';
import * as sendgrid from '@sendgrid/mail';

// Use a send grid API key here
sendgrid.setApiKey('')

admin.initializeApp();

const db = admin.firestore();

const sendEmail = async  (user: any, bookingId: string) => {
  const emailBody = `
  <div>
    <p>Hi ${user.firstName},</p>
    <p>Thank you for booking a parking space with us. This email is to notify you that your booking has been confirmed and your booking ID is <strong>${bookingId}</strong>.</p>
    <p>Feel free to reach out to us if you have any queries.</p>
    <br><br>
    <p>Best,<br>Parking Booking System Team</p>
  </div>`
  const email = {
    to: user.email,
    // this FROM email should be one of SendGrid's Sender Email
    from: '',
    subject: 'Booking Confirmation',
    html: emailBody
  }
  await sendgrid.send(email)
  return true
}

// Send Email To Notify User about booking completion
export const onBookingConfirm = functions.firestore.document('/ParkingAreas/{ParkingAreaId}/ParkingSpaces/{ParkingSpaceId}/Bookings/{BookingId}')
.onCreate(async (snap, context) => {
  const { state, uid } = snap.data()
  if(state === 'send-booking-email') {
    const userData: any = (await db.collection('Users').doc(uid).get()).data()

    // Update Root Bookings Collection
    const bookingDocPath = snap.ref.path
    const newBooking = await db.collection('Bookings').add({ ref: bookingDocPath, uid, timestamp: Date.now() })
    
    // Send Email
    await sendEmail(userData, newBooking.id)
    console.log(`Booking Confirmed, also an email has been sent to ${userData.firstName} ${userData.lastName}`)

    // Update Nested Booking Document
    let docObj = snap.data()
    docObj.state = 'email-sent';
    await snap.ref.update(docObj)
  }
})

// Delete Booking Document On Cancellation
export const onBookingCancel = functions.firestore.document('/Bookings/{BookingId}').onUpdate(async (snap, context) => {
  const { state, ref } = snap.after.data();
  if(state === 'cancel-booking') {
    const { 1: parkingAreaId, 3: parkingSpaceId, 5: parkingBookingId } = ref.split('/');
    const bookingPath = db.collection('ParkingAreas').doc(parkingAreaId)
    .collection('ParkingSpaces').doc(parkingSpaceId).collection('Bookings').doc(parkingBookingId)
    await bookingPath.delete()
    await snap.after.ref.delete()
  }
})


// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
