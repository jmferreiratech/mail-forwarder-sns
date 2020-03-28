import AWS from "aws-sdk";

const forwardTo = process.env.to_address;

export const handler = async function (event, context) {
    for (const Record of event.Records) {
        try {
            await handleMessage(Record.Sns.Message);
        } catch (e) {
            // decide how to handle the errors
            console.error(e);
        }
    }
};

async function handleMessage(Message) {
    const msg = JSON.parse(Message);
    const {
        notificationType,
        receipt: {recipients},
        mail: {source, commonHeaders: {subject}},
        content,
    } = msg;

    if (notificationType !== "Received") {
        return console.warn(`Unknown notification type: ${notificationType}`);
    }

    const headers = mailHeaders(recipients, source, subject, content);
    const body = mailBody(content);
    const Data = `${headers}\r\n\r\n${body}`;

    const data = await new AWS.SES()
        .sendRawEmail({RawMessage: { Data }})
        .promise();
    console.log('Forwarded with MessageId: ' + data.MessageId);
}

function mailHeaders(recipients, source, subject, content) {
    const headers = [
        `From: ${recipients[0]}`,
        `Reply-To: ${source}`,
        `To: ${forwardTo}`,
        `Subject: Fwd: ${subject}`,
    ];

    if (content) {
        let res = content.match(/Content-Type:.+\s*boundary.*/);
        if (res) {
            headers.push(res[0]);
        } else {
            res = content.match(/^Content-Type:(.*)/m);
            if (res) {
                headers.push(res[0]);
            }
        }

        res = content.match(/^Content-Transfer-Encoding:(.*)/m);
        if (res) {
            headers.push(res[0]);
        }

        res = content.match(/^MIME-Version:(.*)/m);
        if (res) {
            headers.push(res[0]);
        }
    }

    return headers.join("\r\n")
}

function mailBody(content) {
    if (!content) {
        return "Empty email";
    }
    const [, ...body] = content.split("\r\n\r\n");
    return body.join("\r\n\r\n");
}
