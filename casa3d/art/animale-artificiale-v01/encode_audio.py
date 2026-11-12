"""Encode the approved Drive WAVs as one browser MP3 per track using Audacity's DLLs."""
import argparse
import ctypes as c
import hashlib
import json
import os
import re
from pathlib import Path


class SoundInfo(c.Structure):
    _fields_ = [
        ("frames", c.c_int64), ("samplerate", c.c_int), ("channels", c.c_int),
        ("format", c.c_int), ("sections", c.c_int), ("seekable", c.c_int),
    ]


def function(library, name, result, *parameters):
    call = getattr(library, name)
    call.restype = result
    call.argtypes = list(parameters)
    return call


def encode_all(originals, audacity):
    casa = Path(__file__).resolve().parents[2]
    album = (casa / "src/rooms/musicAlbum.mjs").read_text(encoding="utf-8")
    sources = re.findall(r"'(AHBOUNCE_[^']+\.wav)'", album)
    if len(sources) != 13 or not all((originals / name).is_file() for name in sources):
        raise ValueError("The 13 WAV files in musicAlbum.mjs must be present in the source folder.")

    output = casa / "audio/animale-artificiale"
    output.mkdir(parents=True, exist_ok=True)
    float_buffer = c.POINTER(c.c_float)
    byte_buffer = c.POINTER(c.c_ubyte)
    with os.add_dll_directory(str(audacity)):
        snd = c.CDLL(str(audacity / "sndfile.dll"))
        lame = c.CDLL(str(audacity / "libmp3lame.dll"))
        snd_open = function(snd, "sf_wchar_open", c.c_void_p, c.c_wchar_p, c.c_int, c.POINTER(SoundInfo))
        snd_read = function(snd, "sf_readf_float", c.c_int64, c.c_void_p, float_buffer, c.c_int64)
        snd_close = function(snd, "sf_close", c.c_int, c.c_void_p)
        lame_init = function(lame, "lame_init", c.c_void_p)
        lame_ready = function(lame, "lame_init_params", c.c_int, c.c_void_p)
        lame_encode = function(lame, "lame_encode_buffer_interleaved_ieee_float", c.c_int,
                               c.c_void_p, float_buffer, c.c_int, byte_buffer, c.c_int)
        lame_mono = function(lame, "lame_encode_buffer_ieee_float", c.c_int,
                             c.c_void_p, float_buffer, float_buffer, c.c_int, byte_buffer, c.c_int)
        lame_flush = function(lame, "lame_encode_flush", c.c_int, c.c_void_p, byte_buffer, c.c_int)
        lame_close = function(lame, "lame_close", c.c_int, c.c_void_p)
        setters = {
            key: function(lame, f"lame_set_{key}", c.c_int, c.c_void_p, c.c_int)
            for key in ("in_samplerate", "num_channels", "brate", "quality", "bWriteVbrTag")
        }
        manifest = []
        for index, name in enumerate(sources, 101):
            info = SoundInfo()
            wav = snd_open(str(originals / name), 0x10, c.byref(info))
            if not wav:
                raise ValueError(f"Cannot decode {name}")
            encoder = lame_init()
            temp = output / f"03.{index}.tmp"
            path = temp.with_suffix(".mp3")
            try:
                if info.channels not in (1, 2) or info.frames <= 0 or not encoder:
                    raise ValueError(f"Unsupported WAV: {name}")
                options = dict(in_samplerate=info.samplerate, num_channels=info.channels,
                               brate=192, quality=2, bWriteVbrTag=0)
                if any(setters[key](encoder, value) < 0 for key, value in options.items()) or lame_ready(encoder) < 0:
                    raise ValueError(f"Cannot initialize MP3 encoder for {name}")
                frames = 8192
                samples = (c.c_float * (frames * info.channels))()
                encoded = (c.c_ubyte * 20000)()
                read_frames = 0
                with temp.open("wb") as stream:
                    while count := snd_read(wav, samples, frames):
                        if count < 0:
                            raise ValueError(f"Failed while reading {name}")
                        read_frames += count
                        size = (lame_encode(encoder, samples, count, encoded, len(encoded))
                                if info.channels == 2 else lame_mono(encoder, samples, samples, count, encoded, len(encoded)))
                        if size < 0:
                            raise ValueError(f"Cannot encode {name}")
                        stream.write(bytes(encoded[:size]))
                    tail = lame_flush(encoder, encoded, len(encoded))
                    if tail < 0 or read_frames != info.frames:
                        raise ValueError(f"Incomplete transfer or encode of {name}")
                    stream.write(bytes(encoded[:tail]))
                temp.replace(path)
                manifest.append({"track": f"03.{index}", "source": name, "bytes": path.stat().st_size,
                                 "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                 "durationSeconds": round(info.frames / info.samplerate, 3),
                                 "sampleRate": info.samplerate, "channels": info.channels})
                print(f"{path.name}: {manifest[-1]['durationSeconds']} s, {manifest[-1]['bytes']} bytes")
            finally:
                snd_close(wav)
                if encoder:
                    lame_close(encoder)
                temp.unlink(missing_ok=True)
        (Path(__file__).parent / "audio-encoding.json").write_text(
            json.dumps({"codec": "MP3 CBR 192 kbps", "tracks": manifest}, indent=2) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("originals", type=Path)
    cli.add_argument("--audacity", type=Path, default=Path(r"C:\Program Files\Audacity"))
    args = cli.parse_args()
    encode_all(args.originals.resolve(), args.audacity.resolve())

