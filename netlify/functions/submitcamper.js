const { google } = require("googleapis");

const SHEET_ID = "1gr5g5hEFli9nsKUXCmtIkTNYMxOjjq8UJGBuhA1r48I";
const MASTER_SHEET = "Full";
const GROUP_COL = 13;
const CONFIRMED_COL = 14;
const CONFIRMED_TIME_COL = 15;

const GROUP_LINKS = {
  "纹样工匠":   "https://chat.whatsapp.com/BVN08Krd7U1HZaKV4uLYsi?mode=gi_t",
  "碑文守望者": "https://chat.whatsapp.com/IDt6c3h2fBi5vnG1N8LD3Q?mode=gi_t",
  "药香守护者": "https://chat.whatsapp.com/GzYRSmxokqj3cRpOXFNafB?mode=gi_t",
  "时空行旅人": "https://chat.whatsapp.com/HqLFsHDgFIhDsOrXQrYSnK?mode=gi_t",
  "彩米绘界者": "https://chat.whatsapp.com/DLLjqlK6KEJDSaLYEJCqWp?mode=gi_t",
  "声韵传人":   "https://chat.whatsapp.com/FcqsgCBuhLL4NPnqc6iuUt?mode=gi_t",
  "礼仪思辩者": "https://chat.whatsapp.com/Kk5cGAYYGlX6KdBE6Qw9rh?mode=gi_t",
  "战舞行者":   "https://chat.whatsapp.com/Ll8Dp0UtMANHtAUMLk1XUC?mode=gi_t",
};

const FIELD_COL_MAP = {
  chinese_name:   2,
  english_name:   3,
  ic:             4,
  contact:        5,
  school:         6,
  tshirt:         7,
  meal:           8,
  health:         9,
  transport:      10,
  emergency_name: 11,
  emergency_num:  12,
};

async function findRowInSheet(sheets, sheetName, userId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: sheetName,
  });
  const rows = res.data.values || [];
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(userId)) {
      return { rowIndex: i + 1, rowData: rows[i] };
    }
  }
  return null;
}

async function updateRow(sheets, sheetName, rowIndex, params, changedFields, now) {
  const requests = [];

  changedFields.forEach(key => {
    const col = FIELD_COL_MAP[key];
    if (col && params[key] !== undefined) {
      requests.push({
        range: `${sheetName}!${colLetter(col)}${rowIndex}`,
        values: [[params[key]]],
      });
    }
  });

  requests.push({
    range: `${sheetName}!${colLetter(CONFIRMED_COL)}${rowIndex}`,
    values: [["confirmed"]],
  });
  requests.push({
    range: `${sheetName}!${colLetter(CONFIRMED_TIME_COL)}${rowIndex}`,
    values: [[now]],
  });

  if (requests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: requests,
      },
    });
  }

  // Highlight changed cells yellow
  if (changedFields.length > 0) {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    if (sheet) {
      const sheetId = sheet.properties.sheetId;
      const colorRequests = changedFields
        .filter(key => FIELD_COL_MAP[key])
        .map(key => ({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowIndex - 1,
              endRowIndex: rowIndex,
              startColumnIndex: FIELD_COL_MAP[key] - 1,
              endColumnIndex: FIELD_COL_MAP[key],
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.96, blue: 0.27 },
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        }));

      if (colorRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: { requests: colorRequests },
        });
      }
    }
  }
}

function colLetter(col) {
  let letter = "";
  while (col > 0) {
    const mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const params = JSON.parse(event.body);
    const { userId, changedFields = [] } = params;

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const masterResult = await findRowInSheet(sheets, MASTER_SHEET, userId);
    if (!masterResult) {
      return { statusCode: 404, body: JSON.stringify({ error: "找不到资料" }) };
    }

    const now = new Date().toLocaleString("zh-MY", { timeZone: "Asia/Kuala_Lumpur" });

    await updateRow(sheets, MASTER_SHEET, masterResult.rowIndex, params, changedFields, now);

    const groupName = String(masterResult.rowData[GROUP_COL - 1] || "").trim();
    if (groupName) {
      const groupResult = await findRowInSheet(sheets, groupName, userId);
      if (groupResult) {
        await updateRow(sheets, groupName, groupResult.rowIndex, params, changedFields, now);
      }
    }

    const groupLink = GROUP_LINKS[groupName] || "";

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, groupName, groupLink }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
