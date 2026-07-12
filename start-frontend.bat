@echo off
rem There is no separate frontend/backend process in this project - the
rem backend is hosted on Supabase and the only local process is the web
rem app. This forwards to the single launcher so either filename works.
call "%~dp0start-backend.bat"
