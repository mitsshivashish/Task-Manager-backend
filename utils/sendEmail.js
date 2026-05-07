const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 2525 ,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,

  tls: {
    rejectUnauthorized: false
  }
});

console.log("Using SMTP:", process.env.EMAIL_USER);

const sendEmail = async (to, subject, text, html) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
};


module.exports = sendEmail;

// port can be one more like 587