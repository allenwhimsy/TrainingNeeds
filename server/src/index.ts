import express from "express";
import cors from "cors";
import QRCode from "qrcode";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { LLMClient, Config } from "coze-coding-dev-sdk";
import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from "./storage/database/supabase-client";

const app = express();
const port = process.env.PORT || 9091;

// Middleware - MUST be at the top
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Supabase client
let supabase;
try {
  supabase = getSupabaseClient();
  console.log("Supabase client initialized");
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
  process.exit(1);
}

// Initialize LLM Client
let llmClient;
try {
  llmClient = new LLMClient(new Config());
  console.log("LLM client initialized");
} catch (e) {
  console.error("Failed to initialize LLM client:", e);
  process.exit(1);
}

// Initialize S3 Storage
let storage;
try {
  storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    bucketName: process.env.COZE_BUCKET_NAME,
  });
  console.log("Storage initialized");
} catch (e) {
  console.error("Failed to initialize storage:", e);
  process.exit(1);
}

// Helper to get base URL
const getBaseUrl = (req: express.Request) => {
  const protocol = req.protocol;
  const host = req.get("host");
  return `${protocol}://${host}`;
};

// Health check
app.get("/api/v1/health", (req, res) => {
  console.log("Health check success");
  res.status(200).json({ status: "ok" });
});

// Create questionnaire
app.post("/api/v1/questionnaires", async (req, res) => {
  try {
    const { title, description, deadline } = req.body || {};

    if (!title || !deadline) {
      return res.status(400).json({ error: "Title and deadline are required" });
    }

    // Generate QR code URL
    const questionnaireId = Date.now();
    const fillUrl = `${getBaseUrl(req)}#/fill/${questionnaireId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(fillUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    // Insert questionnaire
    const { data, error } = await supabase
      .from("questionnaires")
      .insert({
        title,
        description: description || "",
        deadline,
        status: "active",
        qr_code_url: qrCodeDataUrl,
      })
      .select()
      .single();

    if (error) throw new Error(`创建问卷失败: ${error.message}`);

    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error creating questionnaire:", error);
    res.status(500).json({ error: error.message || "Failed to create questionnaire" });
  }
});

// Get questionnaire by ID
app.get("/api/v1/questionnaires/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("questionnaires")
      .select("*")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (error) throw new Error(`查询问卷失败: ${error.message}`);

    if (!data) {
      return res.status(404).json({ error: "Questionnaire not found" });
    }

    // Generate QR code if not exists
    if (!data.qr_code_url) {
      const fillUrl = `${getBaseUrl(req)}#/fill/${data.id}`;
      data.qr_code_url = await QRCode.toDataURL(fillUrl, {
        width: 300,
        margin: 2,
      });
    }

    res.json(data);
  } catch (error: any) {
    console.error("Error fetching questionnaire:", error);
    res.status(500).json({ error: error.message || "Failed to fetch questionnaire" });
  }
});

// List all questionnaires
app.get("/api/v1/questionnaires", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("questionnaires")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`查询问卷列表失败: ${error.message}`);

    res.json(data || []);
  } catch (error: any) {
    console.error("Error listing questionnaires:", error);
    res.status(500).json({ error: error.message || "Failed to list questionnaires" });
  }
});

// Submit suggestion
app.post("/api/v1/questionnaires/:id/suggestions", async (req, res) => {
  try {
    const { id } = req.params;
    const { content, submitterName } = req.body || {};

    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    // Check if questionnaire exists and is active
    const { data: questionnaire, error: qError } = await supabase
      .from("questionnaires")
      .select("*")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (qError) throw new Error(`查询问卷失败: ${qError.message}`);

    if (!questionnaire) {
      return res.status(404).json({ error: "Questionnaire not found" });
    }

    // Check if deadline has passed
    if (new Date(questionnaire.deadline) < new Date()) {
      return res.status(400).json({
        error: "Submission deadline has passed",
        deadline: questionnaire.deadline,
      });
    }

    // Insert suggestion
    const { data, error } = await supabase
      .from("suggestions")
      .insert({
        questionnaire_id: parseInt(id),
        content,
        submitter_name: submitterName || "Anonymous",
      })
      .select()
      .single();

    if (error) throw new Error(`提交意见失败: ${error.message}`);

    res.status(201).json(data);
  } catch (error: any) {
    console.error("Error submitting suggestion:", error);
    res.status(500).json({ error: error.message || "Failed to submit suggestion" });
  }
});

// Get suggestions for a questionnaire
app.get("/api/v1/questionnaires/:id/suggestions", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("suggestions")
      .select("*")
      .eq("questionnaire_id", parseInt(id))
      .order("created_at", { ascending: false });

    if (error) throw new Error(`查询意见列表失败: ${error.message}`);

    res.json(data || []);
  } catch (error: any) {
    console.error("Error fetching suggestions:", error);
    res.status(500).json({ error: error.message || "Failed to fetch suggestions" });
  }
});

// Get report for a questionnaire
app.get("/api/v1/questionnaires/:id/report", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("questionnaire_id", parseInt(id))
      .maybeSingle();

    if (error) throw new Error(`查询报告失败: ${error.message}`);

    if (!data) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Generate download URL if word file exists but no URL
    if (data.word_file_key && !data.word_download_url) {
      data.word_download_url = await storage.generatePresignedUrl({
        key: data.word_file_key,
        expireTime: 86400 * 7, // 7 days
      });
    }

    res.json(data);
  } catch (error: any) {
    console.error("Error fetching report:", error);
    res.status(500).json({ error: error.message || "Failed to fetch report" });
  }
});

// Trigger analysis
app.post("/api/v1/questionnaires/:id/analyze", async (req, res) => {
  try {
    const { id } = req.params;

    // Get questionnaire
    const { data: questionnaire, error: qError } = await supabase
      .from("questionnaires")
      .select("*")
      .eq("id", parseInt(id))
      .maybeSingle();

    if (qError) throw new Error(`查询问卷失败: ${qError.message}`);

    if (!questionnaire) {
      return res.status(404).json({ error: "Questionnaire not found" });
    }

    // Get all suggestions
    const { data: suggestions, error: sError } = await supabase
      .from("suggestions")
      .select("*")
      .eq("questionnaire_id", parseInt(id))
      .order("created_at", { ascending: true });

    if (sError) throw new Error(`查询意见列表失败: ${sError.message}`);

    if (!suggestions || suggestions.length === 0) {
      return res.status(400).json({ error: "No suggestions to analyze" });
    }

    // Create or update report record
    let { data: existingReport } = await supabase
      .from("reports")
      .select("*")
      .eq("questionnaire_id", parseInt(id))
      .maybeSingle();

    let reportId;
    if (!existingReport) {
      const { data: newReport, error: insertError } = await supabase
        .from("reports")
        .insert({
          questionnaire_id: parseInt(id),
          status: "processing",
        })
        .select()
        .single();

      if (insertError) throw new Error(`创建报告记录失败: ${insertError.message}`);
      reportId = newReport.id;
    } else {
      reportId = existingReport.id;
      await supabase
        .from("reports")
        .update({ status: "processing" })
        .eq("id", reportId);
    }

    // Build analysis prompt
    const suggestionsText = suggestions
      .map(
        (s, i) =>
          `${i + 1}. [${s.submitter_name}] ${s.content} (${new Date(s.created_at).toLocaleString()})`
      )
      .join("\n");

    const prompt = `你是培训需求分析专家。请分析以下培训反馈意见，生成一份专业的培训需求分析报告。

问卷标题：${questionnaire.title}
问卷描述：${questionnaire.description || "无"}
收集时间：${new Date(questionnaire.created_at).toLocaleString()} 至 ${new Date(questionnaire.deadline).toLocaleString()}
反馈总数：${suggestions.length}条

收集到的反馈意见：
${suggestionsText}

请从以下维度进行分析并输出报告：

## 一、数据概览
- 总反馈数量
- 提交时间分布

## 二、主要反馈主题
提炼出3-5个主要反馈主题/关注点

## 三、需求优先级排序
按重要性对培训需求进行排序，给出优先级建议

## 四、具体培训建议
针对每个主要需求，给出具体的培训内容和方法建议

## 五、风险与注意事项
识别可能存在的风险或需要特别关注的问题

## 六、总结
用一段话总结整体培训需求

请使用专业的培训管理语言，报告要结构清晰、可操作性强。`;

    // Call LLM for analysis
    let analysisContent = "";
    try {
      const response = await llmClient.invoke(
        [{ role: "user", content: prompt }],
        { model: "doubao-seed-2-0-pro-260215", temperature: 0.7 }
      );
      analysisContent = response.content;
    } catch (llmError: any) {
      console.error("LLM error:", llmError);
      analysisContent = `LLM分析服务暂时不可用，请稍后重试。错误信息: ${llmError?.message || 'Unknown error'}`;
    }

    // Generate Word document
    let wordFileKey = null;
    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: `${questionnaire.title} - 培训需求分析报告`,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `生成时间：${new Date().toLocaleString()}`,
                    size: 24,
                    color: "666666",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
              new Paragraph({
                text: analysisContent,
                spacing: { after: 200 },
              }),
            ],
          },
        ],
      });

      const docBuffer = await Packer.toBuffer(doc);
      const fileName = `reports/${questionnaire.id}_${Date.now()}_report.docx`;

      wordFileKey = await storage.uploadFile({
        fileContent: Buffer.from(docBuffer),
        fileName: fileName,
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      // Update report with Word file key
      await supabase
        .from("reports")
        .update({
          analysis_content: analysisContent,
          word_file_key: wordFileKey,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      // Update questionnaire status
      await supabase
        .from("questionnaires")
        .update({ status: "completed" })
        .eq("id", parseInt(id));
    } catch (docError) {
      console.error("Document generation error:", docError);
      await supabase
        .from("reports")
        .update({
          analysis_content: analysisContent,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);
    }

    // Get updated report
    const { data: updatedReport, error: reportError } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .maybeSingle();

    if (reportError) throw new Error(`查询报告失败: ${reportError.message}`);

    let responseData = updatedReport;

    // Generate download URL
    if (responseData.word_file_key) {
      responseData.word_download_url = await storage.generatePresignedUrl({
        key: responseData.word_file_key,
        expireTime: 86400 * 7,
      });
    }

    res.json(responseData);
  } catch (error: any) {
    console.error("Error triggering analysis:", error);
    res.status(500).json({ error: error.message || "Failed to trigger analysis" });
  }
});

// Download word report
app.get("/api/v1/questionnaires/:id/report/download", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("reports")
      .select("word_file_key")
      .eq("questionnaire_id", parseInt(id))
      .maybeSingle();

    if (error) throw new Error(`查询报告失败: ${error.message}`);

    if (!data || !data.word_file_key) {
      return res.status(404).json({ error: "Report file not found" });
    }

    const fileKey = data.word_file_key;
    const fileBuffer = await storage.readFile({ fileKey: fileKey });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="training_report_${id}.docx"`
    );
    res.send(fileBuffer);
  } catch (error: any) {
    console.error("Error downloading report:", error);
    res.status(500).json({ error: error.message || "Failed to download report" });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
