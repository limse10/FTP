const express = require("express");
const cors = require("cors");
const mysql = require("mysql");
const e = require("express");
const bodyParser = require("body-parser");
// const Ftp = require("ftp");
const EasyFtp = require("easy-ftp");
const fs = require("fs");
const archiver = require("archiver");
const abspath = require("path").resolve;
const app = express();
const jsonParser = bodyParser.json();
const port = 3000;
const db_cnf = {
  host: "localhost",
  user: "node",
  password: "P@ssword1",
  database: "files",
  insecureAuth: true,
};
const ftp_cnf = {
  host: "localhost",
  port: 21,
  username: "anonymous",
  password: "anonymous",
  type: "ftp",
};
let db = mysql.createPool(db_cnf);
let ezftp = new EasyFtp();

app.use(cors());

app.get("/", (req, res) =>
  res.json({
    message: "yeet",
  })
);

app.get("/db/files", (req, res) => {
  db.query("SELECT * FROM files.files", (err, results) => {
    if (err) {
      return res.send(err);
    } else {
      return res.json({
        data: results,
      });
    }
  });
});

function get_db_files() {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM files.files`;
    db.query(sql, function (err, result) {
      if (err) {
      } else {
        resolve(result);
      }
    });
  });
}

function get_ftp_files() {
  return new Promise((resolve, reject) => {
    ezftp.connect(ftp_cnf);
    ezftp.ls("/", (err, list) => {
      ezftp.close();
      if (err) {
      } else {
        resolve(list);
      }
    });
  });
}

app.get("/db/sync", async (req, res) => {
  let db_file_data = await get_db_files();
  let db_files = db_file_data.map((obj) => {
    return obj.path;
  });
  let ftp_file_data = await get_ftp_files();
  let ftp_files = ftp_file_data.map((obj) => {
    return obj.name;
  });
  let db_missing = ftp_files.filter((x) => !db_files.includes(x));
  let db_extra = db_files.filter((x) => !ftp_files.includes(x));
  let values = db_missing
    .map(
      (file) =>
        `("${file}","${
          ftp_file_data.find((obj) => {
            return obj.name === file;
          }).type
        }")`
    )
    .join(",");
  let sql = `INSERT INTO files.files (path,type) VALUES ${values}`;
  db.query(sql, [values], (err, res) => {});
  console.log("DB Synchronised");
  res.send("done!");
});

app.get("/db/list", async (req, res) => {
  let db_data = await get_db_files();
  return res.json(db_data);
});

// function createTag(name) {}

// function assignTag(fileid, tagid) {}
app.get("/db/removeTag", (req, res) => {
  file_id = req.query.file_id;
  tag_id = req.query.tag_id;
  let sql = `DELETE FROM files.map WHERE file_id=${file_id} AND tag_id=${tag_id}`;
  db.query(sql, (err, result) => {
    res.send("ok");
  });
});
app.get("/db/addTag", (req, res) => {
  file_id = req.query.file_id;
  tag = req.query.tag;
  let sql = `INSERT INTO files.tags (name)
  SELECT * FROM (SELECT '${tag}') AS tmp
  WHERE NOT EXISTS (
      SELECT name FROM files.tags WHERE name = '${tag}') LIMIT 1`;
  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
    } else {
      let sql = `INSERT INTO files.map (file_id, tag_id)
      SELECT * FROM (SELECT ${file_id},(SELECT id FROM files.tags WHERE name='${tag}')) AS tmp
      WHERE NOT EXISTS( SELECT file_id,tag_id FROM files.map
      WHERE file_id=${file_id} AND tag_id=(SELECT id FROM files.tags WHERE name='${tag}')) LIMIT 1`;

      db.query(sql, (err, results) => {
        if (err) {
          console.log(err);
        } else {
          res.send("ok!");
        }
      });
    }
  });
});

app.get("/db/getTags", async (req, res) => {
  id = req.query.id;
  let sql = `SELECT t.*  
  FROM files.map ft, files.tags t 
  WHERE ft.tag_id=t.id
  AND ft.file_id = ${id}
  GROUP BY t.id`;
  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
    } else {
      res.json(results);
    }
  });
});

function filterByTags(taglist, searchType) {
  return new Promise((resolve, reject) => {
    if (taglist.length !== 0) {
      let sql = `SELECT * FROM files.files`;
      if (searchType === "AND") {
        sql = `SELECT f.*  
        FROM files.map ft, files.files f, files.tags t 
        WHERE ft.tag_id=t.id
        AND (t.name IN (${taglist.map((tag) => `'${tag}'`).join(",")}))
        AND f.id = ft.file_id
        GROUP BY f.id
        HAVING COUNT(f.id)=${taglist.length}`;
      } else if (searchType === "OR") {
        sql = `SELECT f.*  
        FROM files.map ft, files.files f, files.tags t 
        WHERE ft.tag_id=t.id
        AND (t.name IN (${taglist.map((tag) => `'${tag}'`).join(",")}))
        AND f.id = ft.file_id
        GROUP BY f.id`;
      }
      db.query(sql, (err, res) => {
        if (err) {
          console.log(err);
        } else {
          resolve(res);
        }
      });
    }
  });
}

app.get("/db/filter", async (req, res) => {
  const taglist = req.query.taglist.split(",");
  const searchType = req.query.searchType;
  let filtered = await filterByTags(taglist, searchType);
  return res.send(filtered);
});

app.get("/ftp/list", (req, res) => {
  ezftp.connect(ftp_cnf);
  ezftp.ls("/", (err, list) => {
    ezftp.close();
    if (err) {
    } else {
      return res.json(list);
    }
  });
});

function downloadFolder(dir) {
  return new Promise((resolve, reject) => {
    const src_path = "./files/downloads/" + dir;
    const zip_path = `./files/zipped/${dir}.zip`;
    if (fs.existsSync(zip_path)) {
      resolve(zip_path);
    } else {
      ezftp.connect(ftp_cnf);
      ezftp.download(dir, "./files/downloads", function (err) {
        ezftp.close();
        if (err) {
          console.log(err);
        } else {
          const output = fs.createWriteStream(zip_path);
          const archive = archiver("zip", { zlib: { level: 9 } });
          output.on("close", function () {
            fs.rmdir(src_path, { recursive: true }, (err) => {});
            resolve(zip_path);
          });
          archive.pipe(output);
          archive.directory(src_path, false);
          archive.finalize();
        }
      });
    }
  });
}
app.get("/ftp/zip", async (req, res) => {
  const zip = await downloadFolder(req.query.dir);
  const url = `ftp/download?zip=${zip}`;
  return res.send(url);
});
app.get("/ftp/download", async (req, res) => {
  const zip = req.query.zip;

  return res.download(zip);
});

app.listen(port, () => console.log(`listening on port ${port}`));
