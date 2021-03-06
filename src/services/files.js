const squel = require("squel");
const { insert, update, select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);
const fs = require('fs');
const mime = require('mime-to-extensions');
const { getUserIdFromToken } = require('../util');
const db = require('../../db');
const { filesDir } = require('../../config');
const { createLoaders } = require('../loaders');

exports.getFile = async (req, res) => {
  try {
    let { headers } = req;
    let { authorization } = headers;
    let userId = null;
    if (authorization) {
      userId = getUserIdFromToken(authorization);
    }
    let { id } = req.params;
    if (String(parseInt(id, 10)) != id) throw new Error('id must be an integer');
    if (id <= 0) throw new Error('id must be positive and non-zero');
    let where2 =
      or(
         and('es.is_public = 1')
        .and(
           or('es.status = ?', 'Published')
          .or('es.are_changes_visible = 1')
        )
      )
      .or(
         and('esu.is_public = 1')
        .and(
           or('esu.status = ?', 'Published')
          .or('esu.are_changes_visible = 1')
        )
      );
    if (userId) {
      where2 = where2
       .or('e.host_user_id = ?', userId)
       .or('esu.host_user_id = ?', userId)
       .or('? IN (rsse.participant, rsse.fill_in_participant)', userId)
       .or(
          and('rssu.participant = ?', userId)
         .and('rssu.fill_in_participant IS NULL')
       )
       .or('rssu.fill_in_participant = ?', userId)
    }
    let { text, values } = select()
      .field('f.filename')
      .field('f.sizeBytes')
      .from('files', 'f')
      .left_join('events', 'e', 'f.id = e.initial_file')
      .left_join('roundsubmissions', 'rsse', 'f.id = rsse.file_id_seeded')
      .left_join('events', 'es', 'rsse.event_id = es.id')
      .left_join('roundsubmissions', 'rssu', 'f.id = rssu.file_id_submitted')
      .left_join('events', 'esu', 'rssu.event_id = esu.id')
      .where(
         and('f.id = ?', id)
        .and(where2)
      )
      .limit(1)
      .toParam();
    let [ rows ] = await db.query(text, values);
    if (rows.length == 0) throw new Error('File not found');
    let { filename, sizeBytes } = rows[0];
    let [ extension ] = filename.split('.').slice(-1);
    res.download(`${filesDir}/${filename}`, `${id}.${extension}`);
  } catch (err) {
    res.send({ code: 500, message: err.message });
  }
};

exports.uploadRoundsubmissionFile = pubSub => async (req, res) => {
  try {
    let loaders = createLoaders();
    let { eventsById, usersById, roundsById, roundsubmissionsById } = loaders;
    let { headers, files } = req;
    let { authorization } = headers;
    if (!authorization) throw new Error('Authorization required');
    if (Object.keys(files).length !== 1) {
      throw new Error('You have to upload one file');
    }
    let file = files[Object.keys(files)[0]];
    let userId = getUserIdFromToken(authorization);
    if (!userId) throw new Error('Could not find user');
    let { id } = req.params;
    if (String(parseInt(id, 10)) != id) throw new Error('id must be an integer');
    if (id <= 0) throw new Error('id must be positive and non-zero');
    let { text, values } = select()
    .from('roundsubmissions', 'rs')
    .join('events', 'e', 'rs.event_id = e.id')
    .where(
       and('rs.id = ?', id)
      .and('rs.round_id = e.current_round')
      .and(
         or(
            and('rs.participant = ?', userId)
           .and('rs.fill_in_participant IS NULL')
           .and('rs.status IN ?', ['Started','Submitted','Refuted'])
         )
        .or(
           and('rs.fill_in_participant = ?', userId)
          .and('rs.status IN ?', ['FillInAquired','Submitted','Refuted'])
        )
      )
    ).toParam();
    let [ rows ] = await db.query(text, values);
    if (rows.length == 0) throw new Error('Access denied');
    let [ extension ] = file.name.split('.').slice(-1);
    if (!extension) extension = mime.extension(file.mimetype) || 'file';
    await db.transaction(async (t) => {
      let [{ insertId }] = await t.query('INSERT INTO files () VALUES ()');
      let { filename, stats: { size } } = await new Promise((res, rej) => {
        let filename = `${insertId}.${extension}`;
        let filenameFull = `${filesDir}/${filename}`;
        file.mv(filenameFull, (err) => {
          if (err) throw new Error(err);
          fs.stat(filenameFull, (err, stats) => {
            if (err) throw new Error(err);
            res({ filename, stats });
          });
        });
      });
      let p = update().table('files').setFields({ filename, sizeBytes: size })
      .where('id = ?', insertId).toParam();
      let p2 = update().table('roundsubmissions', 'rs').setFields({
        file_id_submitted: insertId,
        status: 'Submitted'
      }).where('id = ?', id).toParam();
      await Promise.all([
        await t.query(p.text, p.values),
        await t.query(p2.text, p2.values)
      ]);
    });
    let roundsubmission = await roundsubmissionsById.load(id);
    let [ event, round, participant ] = await Promise.all([
      eventsById.load(roundsubmission.event_id),
      roundsById.load(roundsubmission.round_id),
      usersById.load(userId)
    ]);
    pubSub.publish('eventsChanged', { eventsChanged: [event] });
    pubSub.publish(`event${event.id}Changed`, {
      eventChanged: {
        event,
        message: `${participant.username} has submitted for round ${round.index + 1} of ${event.name}'`
      }
    });
    res.send({ code: 200, message: 'File uploaded!' });
  } catch (err) {
    res.send({ code: 500, message: err.message });
  }
};

exports.uploadEventFile = pubSub => async (req, res) => {
  try {
    let loaders = createLoaders();
    let { usersById } = loaders;
    let { headers, files } = req;
    let { authorization } = headers;
    if (!authorization) throw new Error('Authorization required');
    if (Object.keys(files).length !== 1) {
      throw new Error('You have to upload one file');
    }
    let file = files[Object.keys(files)[0]];
    let userId = getUserIdFromToken(authorization);
    if (!userId) throw new Error('Could not find user');
    let { id } = req.params;
    if (String(parseInt(id, 10)) != id) throw new Error('id must be an integer');
    if (id <= 0) throw new Error('id must be positive and non-zero');
    let { text, values } = select().from('events', 'e')
    .where(
       and('id = ?', id)
      .and('host_user_id = ?', userId)
    ).toParam();
    let [ rows ] = await db.query(text, values);
    if (rows.length == 0) throw new Error('Access denied');
    let event = rows[0];
    if(event.status != 'Planned') {
      throw new Error('Can\'t change initial file after event has been started');
    }
    let [ extension ] = file.name.split('.').slice(-1);
    if (!extension) extension = mime.extension(file.mimetype) || 'file';
    await db.transaction(async (t) => {
      let [{ insertId }] = await t.query('INSERT INTO files () VALUES ()');
      let { filename, stats: { size } } = await new Promise((res, rej) => {
        let filename = `${insertId}.${extension}`;
        let filenameFull = `${filesDir}/${filename}`;
        file.mv(filenameFull, (err) => {
          if (err) throw new Error(err);
          fs.stat(filenameFull, (err, stats) => {
            if (err) throw new Error(err);
            res({ filename, stats });
          });
        });
      });
      let p = update().table('files').setFields({ filename, sizeBytes: size })
      .where('id = ?', insertId).toParam();
      let p2 = update().table('events', 'e').setFields({
        initial_file: insertId
      }).where('id = ?', id).toParam();
      await Promise.all([
        await t.query(p.text, p.values),
        await t.query(p2.text, p2.values)
      ]);
    });
    let user = await usersById.load(userId);
    pubSub.publish('eventsChanged', { eventsChanged: [event] });
    pubSub.publish(`event${event.id}Changed`, {
      eventChanged: {
        event,
        message: `${user.username} has set/changed the initial file for ${event.name}'`
      }
    });
    res.send({ code: 200, message: 'File uploaded!' });
  } catch (err) {
    res.send({ code: 500, message: err.message });
  }
};
