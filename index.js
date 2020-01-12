const parseString = require('xml2js').parseString;
const Transposer = require('chord-transposer');
const fs = require('fs');

// HTML visualisation concepts:
// [1]: https://jsfiddle.net/6zg5xkc2/20/
// [2]: https://markato.studio/
// [3]: https://github.com/deepflame/opensong.js
// [4]: https://worship.kzoaza.pl/ <- future home


// let t = Transposer.transpose('. F\n This is a song').fromKey('F').toKey('D').toString()
// console.log(t)

let OpenSongHelpers = {
  LINE_LYRICS  : " ",
  LINE_COMMENT : ";",
  LINE_CHORDS  : ".",
  LINE_SECTION : "[",

  lines: song => {
    return song.split(/\r?\n/).filter(x => x.length > 0); ///\r\n|\r|\n/g
  },
  sections: lines => {
    var sections = [];
    var currentSection = "";

    for (var i = 0; i < lines.length; i++) {
      switch (lines[i][0]) {
        case OpenSongHelpers.LINE_SECTION:
          currentSection = lines[i].trim().slice(1, -1); // Naive [(SectionName)] extraction.
          sections[currentSection] = [];
          break;
        case OpenSongHelpers.LINE_COMMENT:
        case OpenSongHelpers.LINE_LYRICS:
        case OpenSongHelpers.LINE_CHORDS:
          if (!currentSection.length) {
            currentSection = "#"; // Protection against unexpected 'no-sections'. :D
            sections[currentSection] = [];
          }
          sections[currentSection].push(lines[i]);
          break;
      }
    }
    return sections;
  },
  processChords: chordLine => {
    let chords = String(chordLine.slice(1)).replace(/\s*$/, "");
    return chords.split(/([ ]+|[\S]+)/gim).filter(x => x.length > 0);
  },
  processLyrics: (chords, lyrics) => {
    let lineChords = chords;
    let lineLyrics = lyrics;

    var pattern = OpenSongHelpers.processChords(lineChords);
    var lyrics = lineLyrics.slice(1);

    var cursor = 0;
    pattern.forEach(p => {
      switch (p[0]) {
        case " ":
          cursor += p.length;
          break;
        default:
          let beg = lyrics.substr(0, cursor);
          let poi = `<a data-chord='${p}'>` + lyrics.substr(cursor, 1) + "</a>";
          let end = lyrics.substr(cursor + 1);

          lyrics = beg + poi + end;
          cursor += poi.length;
          if (p.length > 1) cursor += p.length - 1;
      }
    });
    return lyrics.replace(/[|]*/g, '');
  },
  processSection: section => {
    var finished = "";
    for (var i = 0; i < section.length; i++) {
      if (section[i] != undefined && section[i + 1] != undefined) {
        if (
          section[i][0] === OpenSongHelpers.LINE_CHORDS &&
          section[i + 1][0] === OpenSongHelpers.LINE_LYRICS
        ) {
          finished +=
            `<p>` +
            OpenSongHelpers.processLyrics(section[i], section[i + 1]) +
            `</p>`;
          i++; // Skip one additional line, as the next line is already processed.
          continue;
        }
      }
      if (section[i][0] === OpenSongHelpers.LINE_LYRICS) {
        finished += section[i];
        continue;
      }
      if (section[i][0] === OpenSongHelpers.LINE_CHORDS) {
        var pattern = OpenSongHelpers.processChords(section[i]);
        var chordLine = "";
        pattern.forEach(p => {
          switch (p[0]) {
            case " ":
              chordLine += [...p].map(_ => `&nbsp;`);
              break;
            default:
              chordLine += `<a data-chord='${p}'></a>`;
          }
        });
        finished += `<p>` + chordLine + `</p>`;
        continue;
      }
      if (section[i][0] === OpenSongHelpers.LINE_COMMENT) {
        finished += `<div class='comment'>` + section[i].slice(1) + `</div>`;
        continue;
      }
    }
    return finished;
  },
  processSong: song => {
    let sections = OpenSongHelpers.sections(OpenSongHelpers.lines(song));
    var songRender = "";
    for (var s in sections) {
      if (s != "#") songRender += `<span data-section>${s}</span>`;
      songRender += OpenSongHelpers.processSection(sections[s]);
    }
    return songRender;
  }
};

//let data = fs.readFileSync('./test.xml', 'utf8');



/*
Font size: [+] / [-]
[() Chords] [() Sections] [() Comments] // [() Lyrics]

*/

// Web 'stuff'
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use('/static', express.static(path.join(__dirname, 'public/')));

app.get('/', (req, res) => {
  var html = '<ul>'

  const directoryPath = path.join(__dirname, 'public/songs/');
  fs.readdir(directoryPath, function (err, files) {
      if (err) {
          return console.log('Unable to scan directory: ' + err);
      } 
      //listing all files using forEach
      files.forEach(function (file) {
          html += `<li><a href='/song/${file}'>${path.basename(file, '.xml')}</a></li>`;
      });

      html += '</ul>'
      res.send(html);
  }); 
});

app.get('/song/:id', (req, res) => {
    var songTemp = '';

    fs.readFile(`public/songs/${req.params.id}`, function(err, data) {
        if (err) {
          console.log(err, req.params.id, data);
        }
        console.log(data);
        parseString(data, function (err, result) {


            songTemp += `<link rel="stylesheet" href="/static/stylesheets/song.css">`
            songTemp += `<div class='song'>`;
            songTemp += `<h1>${result.song.title}</h1>`;
            songTemp += `<div class='chords'>`;
            songTemp += OpenSongHelpers.processSong(result.song.lyrics[0]);
            songTemp += `</div><!-- end chords -->`;
            songTemp += `</div><!-- end song -->`;

            songTemp += `<div class='editor'>`;
            songTemp += `<pre>${result.song.lyrics[0]}</pre>`;
            songTemp += `</div><!-- end editor -->`;

            res.send(songTemp);
        });
    });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));