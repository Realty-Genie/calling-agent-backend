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
    static async sendBatchCallReport(userEmail: string, report: any) {
        try {
            const reportEntries = Object.entries(report);
            if (reportEntries.length === 0) return;

            // Extract lead type from the first entry (assuming all leads in a batch have the same type)
            const firstEntry = reportEntries[0];
            if (!firstEntry) return;

            const leadData: any = firstEntry[1];
            const leadType = leadData.leadDetails.leadType;
            const isSeller = leadType === "seller";

            const tableRows = reportEntries.map(([phoneNumber, data]: [string, any]) => {
                const { callDetails, leadDetails } = data;
                let row = `
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${leadDetails.name}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${phoneNumber}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${callDetails.status || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${callDetails.semtiment || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${callDetails.analysis || 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${callDetails.followUp || ''}</td>
                `;

                if (isSeller) {
                    row += `<td style="border: 1px solid #ddd; padding: 8px;">${callDetails.Appointment || ''}</td>`;
                }

                row += `</tr>`;
                return row;
            }).join('');

            const htmlContent = `
                <h2>Batch Call Report</h2>
                <p><strong>Lead Type:</strong> ${leadType.charAt(0).toUpperCase() + leadType.slice(1)}s</p>
                <p>Total Leads: ${reportEntries.length}</p>
                <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Lead Name</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Phone Number</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Sentiment</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Summary</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Follow-up</th>
                            ${isSeller ? '<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Appointment</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows}
                    </tbody>
                </table>
            `;

            const data = await resend.emails.send({
                from: MAIL_FROM,
                to: userEmail,
                subject: `Batch Call Report - ${new Date().toLocaleDateString()}`,
                html: htmlContent,
            });

            return data;
        } catch (error) {
            console.error("Error sending batch call report email:", error);
            throw error;
        }
    }

}
