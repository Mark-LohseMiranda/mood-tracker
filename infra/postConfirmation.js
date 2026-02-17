"use strict";

const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const ses = new SESClient({ region: process.env.AWS_REGION });
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const db = DynamoDBDocumentClient.from(client);

/**
 * Cognito PostConfirmation trigger
 * Sends email notification when a new user confirms their email
 */
exports.handler = async (event) => {
  console.log("PostConfirmation trigger:", JSON.stringify(event, null, 2));

  const { email, name, sub } = event.request.userAttributes;
  const signupTime = new Date().toISOString();

  // Initialize user stats in DynamoDB
  try {
    await db.send(new PutCommand({
      TableName: "UserStats",
      Item: {
        userId: sub,
        entryCount: 0,
        daysTracked: 0,
        streak: 0,
        lastEntryDate: null,
        lastStreakDate: null,
        createdAt: signupTime,
        updatedAt: signupTime
      }
    }));
    console.log(`Initialized stats for user: ${sub}`);
  } catch (error) {
    console.error("Failed to initialize user stats:", error);
    // Don't fail signup if stats init fails
  }

  // Send signup notification email
  try {
    await ses.send(new SendEmailCommand({
      Source: "noreply@myemtee.com",
      Destination: {
        ToAddresses: ["info@myemtee.com"]
      },
      Message: {
        Subject: {
          Data: "New User Signup - My Mood Tracker"
        },
        Body: {
          Text: {
            Data: `A new user has signed up for My Mood Tracker!\n\nDetails:\n- Email: ${email}\n- Name: ${name || 'Not provided'}\n- User ID: ${sub}\n- Signup Time: ${signupTime}\n\nThis is an automated notification from myemtee.com`
          },
          Html: {
            Data: `
              <h2>New User Signup - My Mood Tracker</h2>
              <p>A new user has signed up for My Mood Tracker!</p>
              <h3>Details:</h3>
              <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Name:</strong> ${name || 'Not provided'}</li>
                <li><strong>User ID:</strong> ${sub}</li>
                <li><strong>Signup Time:</strong> ${signupTime}</li>
              </ul>
              <p><em>This is an automated notification from myemtee.com</em></p>
            `
          }
        }
      }
    }));

    console.log(`Notification sent for new user: ${email}`);
  } catch (error) {
    console.error("Failed to send signup notification:", error);
    // Don't fail the signup flow if email fails
  }

  // Must return event for Cognito to continue
  return event;
};
