import { dbQuery } from '../config/db.js';

// GET all surveys
export async function getSurveys(req, res) {
  try {
    const employeeId = req.user ? req.user.employeeId : null;
    const surveys = await dbQuery.all("SELECT * FROM surveys ORDER BY created_at DESC");
    
    let myResponses = [];
    if (employeeId) {
      myResponses = await dbQuery.all("SELECT survey_id FROM survey_responses WHERE employee_id = ?", [employeeId]);
    }
    const myResponseIds = new Set(myResponses.map(r => r.survey_id));

    // Map db columns (snake_case) to frontend expected camelCase keys
    const formatted = surveys.map(s => ({
      id: s.id,
      title: s.title,
      startDate: s.start_date,
      endDate: s.end_date,
      outlets: s.outlets ? JSON.parse(s.outlets) : [],
      questions: s.questions ? JSON.parse(s.questions) : [],
      status: s.status,
      created_at: s.created_at,
      hasCompleted: myResponseIds.has(s.id)
    }));

    return res.status(200).json({
      status: 'success',
      data: formatted
    });
  } catch (error) {
    console.error('getSurveys error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data survey.'
    });
  }
}

// POST create/update a survey
export async function createSurvey(req, res) {
  const { id, title, startDate, endDate, outlets, questions, status } = req.body;

  if (!title || !startDate || !endDate || !questions || !Array.isArray(questions)) {
    return res.status(400).json({
      status: 'error',
      message: 'Judul, tanggal mulai/selesai, dan daftar pertanyaan wajib diisi.'
    });
  }

  try {
    const surveyId = id || `srv-${Date.now()}`;
    const outletsStr = Array.isArray(outlets) ? JSON.stringify(outlets) : '[]';
    const questionsStr = JSON.stringify(questions);
    const surveyStatus = status || 'aktif';

    // Check if exists for update or insert
    const existing = await dbQuery.get("SELECT id FROM surveys WHERE id = ?", [surveyId]);
    if (existing) {
      await dbQuery.run(
        `UPDATE surveys SET title = ?, start_date = ?, end_date = ?, outlets = ?, questions = ?, status = ?
         WHERE id = ?`,
        [title, startDate, endDate, outletsStr, questionsStr, surveyStatus, surveyId]
      );
    } else {
      await dbQuery.run(
        `INSERT INTO surveys (id, title, start_date, end_date, outlets, questions, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [surveyId, title, startDate, endDate, outletsStr, questionsStr, surveyStatus]
      );

      // --- AUTO NOTIFICATION TO MOBILE USERS ---
      // Get all active employees to send notifications
      const employees = await dbQuery.all("SELECT id, outlet FROM employees WHERE status = 'active'");
      
      const targetOutlets = Array.isArray(outlets) ? outlets : [];
      const isGlobal = targetOutlets.length === 0;

      for (const emp of employees) {
        const belongsToTargetOutlet = targetOutlets.some(
          to => (emp.outlet || '').trim().toUpperCase() === to.trim().toUpperCase()
        );
        if (isGlobal || belongsToTargetOutlet) {
          await dbQuery.run(
            `INSERT INTO mobile_user_notifications (employee_id, outlet, title, message, type, is_read)
             VALUES (?, ?, ?, ?, 'survey', 0)`,
            [
              emp.id,
              emp.outlet || 'Global',
              `📝 SURVEY BARU`,
              `Perusahaan mengirimkan survey baru: "${title}". Harap segera isi di aplikasi mobile.`
            ]
          );
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Survey berhasil disimpan dan dikirim.',
      data: { id: surveyId }
    });
  } catch (error) {
    console.error('createSurvey error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat/memperbarui survey.'
    });
  }
}

// DELETE a survey
export async function deleteSurvey(req, res) {
  const { id } = req.params;
  try {
    const existing = await dbQuery.get("SELECT id FROM surveys WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        message: 'Survey tidak ditemukan.'
      });
    }

    // Delete responses first
    await dbQuery.run("DELETE FROM survey_responses WHERE survey_id = ?", [id]);
    await dbQuery.run("DELETE FROM surveys WHERE id = ?", [id]);

    return res.status(200).json({
      status: 'success',
      message: 'Survey berhasil dihapus.'
    });
  } catch (error) {
    console.error('deleteSurvey error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghapus survey.'
    });
  }
}

// GET survey responses
export async function getSurveyResponses(req, res) {
  const { id } = req.params;
  try {
    const responses = await dbQuery.all(
      "SELECT * FROM survey_responses WHERE survey_id = ? ORDER BY submitted_at DESC",
      [id]
    );

    // Format output
    const formatted = responses.map(r => ({
      id: r.id,
      surveyId: r.survey_id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      outlet: r.outlet,
      answers: JSON.parse(r.answers),
      submittedAt: r.submitted_at
    }));

    return res.status(200).json({
      status: 'success',
      data: formatted
    });
  } catch (error) {
    console.error('getSurveyResponses error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data respon survey.'
    });
  }
}

// POST submit survey response
export async function submitSurveyResponse(req, res) {
  const { id } = req.params; // survey_id
  const { employeeId, employeeName, outlet, answers } = req.body;

  if (!employeeId || !answers) {
    return res.status(400).json({
      status: 'error',
      message: 'ID Karyawan dan jawaban survey wajib diisi.'
    });
  }

  try {
    const survey = await dbQuery.get("SELECT title FROM surveys WHERE id = ?", [id]);
    if (!survey) {
      return res.status(404).json({
        status: 'error',
        message: 'Survey tidak ditemukan.'
      });
    }

    const responseId = `sr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const answersStr = JSON.stringify(answers);

    await dbQuery.run(
      `INSERT INTO survey_responses (id, survey_id, employee_id, employee_name, outlet, answers)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [responseId, id, employeeId, employeeName || 'Karyawan', outlet || '', answersStr]
    );

    // --- AUTO NOTIFICATION TO MANAGERS / ADMINS ---
    const supervisors = await dbQuery.all("SELECT id, outlet FROM employees WHERE position IN ('Kepala Cabang', 'Leader', 'Admin')");
    for (const sup of supervisors) {
      if (!outlet || sup.outlet === outlet) {
        await dbQuery.run(
          `INSERT INTO mobile_user_notifications (employee_id, outlet, title, message, type, is_read)
           VALUES (?, ?, ?, ?, 'survey_complete', 0)`,
          [
            sup.id,
            sup.outlet || 'Global',
            `📊 RESPONDEN SURVEY BARU`,
            `Karyawan ${employeeName} (${outlet}) telah mengisi survey: "${survey.title}".`
          ]
        );
      }
    }

    return res.status(201).json({
      status: 'success',
      message: 'Jawaban survey berhasil dikirim.',
      data: { id: responseId }
    });
  } catch (error) {
    console.error('submitSurveyResponse error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengirim jawaban survey.'
    });
  }
}
