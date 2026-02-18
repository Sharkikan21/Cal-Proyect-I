// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://absahqvrgwprwpmyfpsv.supabase.co'; // La encontrarás en Supabase > Settings > API
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFic2FocXZyZ3dwcndwbXlmcHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1OTY1MzMsImV4cCI6MjA2NTE3MjUzM30.QEce1hgk-2wTUC8amAph-FUiW0OLLnAiiSnSnimUGl4'; // La encontrarás en Supabase > Settings > API

export const supabase = createClient(supabaseUrl, supabaseAnonKey);