require('dotenv').config();
const { parseAsync } = require('json2csv');
const request = require('request-promise');
const { csv2json } = require('csvjson-csv2json');
const help = require('../helper');
const { getTurmaName } = require('./../DB_helper');
const { addNewNotificationAlunas } = require('./../notificationAddQueue');
const notificationQueue = require('../../server/models').notification_queue;
const turmaChangelog = require('../../server/models').aluno_turma_changelog;
const { turma } = require('../../server/models');

async function buildCSV(data, texts) {
	if (!data || !data.content || data.content.length === 0) { return { error: texts.error }; }
	const result = await parseAsync(data.content, { includeEmptyRows: true }).then(csv => csv).catch(err => err);
	if (!result) { help.Sentry.captureMessage('Erro no parse!'); return { error: 'Erro no parse!' }; }
	const newFilename = texts.filename.replace('<INPUT>', await getTurmaName(data.input));
	return { csvData: await Buffer.from(result, 'utf8'), filename: `${await help.getTimestamp()}_${newFilename}.csv` };
}

async function getJsonFromURL(url) {
	const csvData = await request.get(url, (error, response, body) => body);
	try {
		if (csvData) {
			const json = csv2json(csvData, { parseNumbers: true });
			if (json) { return json; }
			return false;
		}
		return false;
	} catch (error) {
		return false;
	}
}

async function getFeedbackMsgs(addedALunos, errors) {
	// addedALunos => csvLines.length - errors.length
	const result = [];

	if (addedALunos === 0) {
		result.push('Nenhuma aluna foi adicionada!');
	} else if (addedALunos === 1) {
		result.push('Uma aluna foi adicionada!');
	} else {
		result.push(`${addedALunos} alunas foram adicionadas!`);
	}

	let messageToSend;
	errors.forEach((element) => {
		if (!messageToSend) messageToSend = 'Erros:';
		messageToSend += `\nLinha ${element.line}: ${element.msg}`;
		if (messageToSend.length >= 1700) {
			result.push(messageToSend);
			messageToSend = null;
		}
	});

	if (messageToSend) result.push(messageToSend);

	return result;
}


async function SaveTurmaChange(alunaID, turmaOriginal, turmaNova) {
	if (turmaOriginal !== turmaNova) {
		const alunoTurma = await turma.findOne({ where: { id: turmaOriginal }, raw: true }).then(res => res).catch(err => help.sentryError('Erro em turma.findAll', err));
		const currentModule = await help.findModuleToday(alunoTurma);
		turmaChangelog.create({
			alunoID: alunaID, turmaOriginal, turmaNova, modulo: currentModule,
		}).then(res => res).catch(err => help.sentryError('Erro em turmaChangelog.create', err));
	}
}

// updates (or creates) notifications in queue when the aluna changes the turma
async function NotificationChangeTurma(alunaID, turmaID) {
	const userNotifications = await notificationQueue.findAll({ where: { aluno_id: alunaID }, raw: true }).then(res => res).catch(err => help.sentryError('Erro em notificationQueue.findAll', err));
	if (!userNotifications || userNotifications.length === 0) {
		await addNewNotificationAlunas(alunaID, turmaID);
	} else {
		userNotifications.forEach((notification) => { // update notification onlywhen it hasnt already been sent and the turma differs
			if ((!notification.sent_at && !notification.error) && notification.turma_id !== turmaID) {
				notificationQueue.update({ turma_id: turmaID }, { where: { id: notification.id } })
					.then(rowsUpdated => rowsUpdated).catch(err => help.sentryError('Erro no update do notificationQueue', err));
			}
		});
	}
}

async function formatRespostasCSV(lines, replament) {
	const result = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line['Sondagem Pré']) line['Sondagem Pré'] = true;
		if (line['Sondagem Pós']) line['Sondagem Pós'] = true;

		const newLine = {};
		await Object.keys(line).forEach(async (element) => {
			if (line[element] === true) {
				newLine[element] = replament;
			} else if (line[element] === false) {
				newLine[element] = '';
			} else {
				newLine[element] = line[element];
			}
		});
		result.push(newLine);
	}

	return result;
}

module.exports = {
	buildCSV, getJsonFromURL, getFeedbackMsgs, NotificationChangeTurma, formatRespostasCSV, SaveTurmaChange,
};
