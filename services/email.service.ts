import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const MAIL_FROM = process.env.MAIL_FROM || "RealtyGenie <no-reply@rg.realtygenie.co>";

export class EmailService {
    static async sendUserCallReport(userEmail: string, leadName: string, callData: any) {
        try {
            const { call_summary, user_sentiment, custom_analysis_data } = callData;

            const htmlContent = `
                <h2>Call Report: ${leadName}</h2>
                <p><strong>Lead Name:</strong> ${leadName}</p>
                <p><strong>Sentiment:</strong> ${user_sentiment}</p>
                
                <h3>Summary</h3>
                <p>${call_summary}</p>
                
                <h3>Analysis Data</h3>
                <ul>
                    ${Object.entries(custom_analysis_data || {}).map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`).join('')}
                </ul>
            `;

            const data = await resend.emails.send({
                from: MAIL_FROM,
                to: userEmail,
                subject: `Call Report: ${leadName} - ${custom_analysis_data?.intent || 'Update'}`,
                html: htmlContent,
            });

            return data;
        } catch (error) {
            console.error("Error sending user report email:", error);
            throw error;
        }
    }

    static async sendLeadFollowUpInfoToUser(userEmail: string, leadName: string, intent: string, followUpTime: string, leadEmail: string, leadPhone: string) {
        try {
            const htmlContent = `
                <h2>Lead Follow-up Details</h2>
                <p><strong>Lead Name:</strong> ${leadName}</p>
                <p><strong>Intent:</strong> ${intent}</p>
                <p><strong>Follow-up Time:</strong> ${followUpTime}</p>
                <p><strong>Lead Email:</strong> ${leadEmail}</p>
                <p><strong>Lead Phone:</strong> ${leadPhone}</p>
                <br>
                <p>Please follow up with this lead accordingly.</p>
            `;

            const data = await resend.emails.send({
                from: MAIL_FROM,
                to: userEmail,
                subject: `Follow-up Action: ${leadName}`,
                html: htmlContent,
            });

            return data;
        } catch (error) {
            console.error("Error sending lead follow-up info email:", error);
            throw error;
        }
    }

}
