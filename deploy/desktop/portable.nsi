# -*- coding: utf-8 -*-
Unicode true
Name "U jednoho stolu"
OutFile "portable.exe"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails nevershow
AutoCloseWindow true

!include "FileFunc.nsh"

Page instfiles

Section
  InitPluginsDir
  SetOutPath "$PLUGINSDIR\stul"
  File /r "U jednoho stolu\*.*"

  HideWindow
  ${GetParameters} $0
  ClearErrors
  ExecWait '"$OUTDIR\U jednoho stolu.exe" $0' $1
  IfErrors launch_failed
  SetOutPath "$TEMP"
  SetErrorLevel $1
  Goto done

launch_failed:
  MessageBox MB_OK|MB_ICONSTOP "Aplikaci U jednoho stolu se nepodařilo spustit."
  SetOutPath "$TEMP"
  SetErrorLevel 1
done:
SectionEnd
