const { google } = require("googleapis");

const SHEET_ID = "1gr5g5hEFli9nsKUXCmtIkTNYMxOjjq8UJGBuhA1r48I";
const MASTER_SHEET = "Full";

exports.handler = async (event) => {
  const userId = event.queryStringParameters?.id;
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ error: "无效请求" }) };
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${MASTER_SHEET}`,
    });

    const rows = res.data.values;
    if (!rows) return { statusCode: 404, body: JSON.stringify({ error: "找不到资料" }) };

    const headers = rows[0];
    let found = null;
    let rowIndex = -1;

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(userId)) {
        found = rows[i];
        rowIndex = i + 1;
        break;
      }
    }

    if (!found) return { statusCode: 404, body: JSON.stringify({ error: "找不到营员资料" }) };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rowIndex,
        data: {
          userId:         found[0]  || "",
          chinese_name:   found[1]  || "",
          english_name:   found[2]  || "",
          ic:             found[3]  || "",
          contact:        found[4]  || "",
          school:         found[5]  || "",
          tshirt:         found[6]  || "",
          meal:           found[7]  || "",
          health:         found[8]  || "",
          transport:      found[9]  || "",
          emergency_name: found[10] || "",
          emergency_num:  found[11] || "",
          group:          found[12] || "",
          confirmed:      found[13] || "",
          confirmedTime:  found[14] || "",
        }
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};