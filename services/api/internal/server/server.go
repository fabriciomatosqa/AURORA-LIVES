// Package server implements the explicitly local-only AURORA LIVES development API.
// It is NOT a production authentication, chat persistence, or authorization layer.
package server

import (
  "crypto/rand"
  "encoding/hex"
  "encoding/json"
  "errors"
  "fmt"
  "io"
  "net/http"
  "strings"
  "sync"
  "time"
  "unicode/utf8"
)

type Room struct {
  ID string `json:"id"`
  Name string `json:"name"`
  Kind string `json:"kind"`
}

type Message struct {
  ID string `json:"id"`
  RoomID string `json:"roomId"`
  Author string `json:"author"`
  Text string `json:"text"`
  CreatedAt time.Time `json:"createdAt"`
}

type Server struct {
  mu sync.RWMutex
  rooms []Room
  messages map[string][]Message
  subscribers map[string]map[chan Message]struct{}
}

func New() *Server {
  return &Server{
    rooms: []Room{{ID: "geral", Name: "geral", Kind: "text"}, {ID: "ideias", Name: "ideias-e-feedback", Kind: "text"}},
    messages: make(map[string][]Message),
    subscribers: make(map[string]map[chan Message]struct{}),
  }
}

func (s *Server) Handler() http.Handler {
  mux := http.NewServeMux()
  mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
    jsonReply(w, http.StatusOK, map[string]any{"status": "ok", "name": "AURORA LIVES", "version": "0.0.1", "mode": "local-development"})
  })
  mux.HandleFunc("GET /api/rooms", s.listRooms)
  mux.HandleFunc("POST /api/rooms", s.createRoom)
  mux.HandleFunc("/api/rooms/", s.roomRoute)
  return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
    origin := r.Header.Get("Origin")
    if origin != "" {
      allowed := map[string]bool{
        "http://localhost:1420": true,
        "http://127.0.0.1:1420": true,
        "http://localhost:5173": true,
        "http://127.0.0.1:5173": true,
        "http://tauri.localhost": true,
        "https://tauri.localhost": true,
        "tauri://localhost": true,
      }
      if !allowed[origin] { http.Error(w, "origin not allowed", http.StatusForbidden); return }
      w.Header().Set("Access-Control-Allow-Origin", origin)
      w.Header().Set("Vary", "Origin")
      w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
    }
    if r.Method == http.MethodOptions { w.WriteHeader(http.StatusNoContent); return }
    mux.ServeHTTP(w, r)
  })
}

func jsonReply(w http.ResponseWriter, status int, v any) {
  w.Header().Set("Content-Type", "application/json; charset=utf-8")
  w.Header().Set("Cache-Control", "no-store")
  w.WriteHeader(status)
  _ = json.NewEncoder(w).Encode(v)
}

func decodeJSON(r *http.Request, dest any) error {
  if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") { return errors.New("Content-Type must be application/json") }
  decoder := json.NewDecoder(io.LimitReader(r.Body, 4096))
  decoder.DisallowUnknownFields()
  if err := decoder.Decode(dest); err != nil { return err }
  var extra any
  if err := decoder.Decode(&extra); err != io.EOF { return errors.New("expected a single JSON object") }
  return nil
}

func newID() string {
  b := make([]byte, 12)
  if _, err := rand.Read(b); err != nil { panic(err) }
  return hex.EncodeToString(b)
}

func (s *Server) listRooms(w http.ResponseWriter, r *http.Request) {
  s.mu.RLock()
  rooms := append([]Room(nil), s.rooms...)
  s.mu.RUnlock()
  jsonReply(w, http.StatusOK, rooms)
}

func (s *Server) createRoom(w http.ResponseWriter, r *http.Request) {
  var input struct { Name string `json:"name"` }
  if err := decodeJSON(r, &input); err != nil { http.Error(w, err.Error(), http.StatusBadRequest); return }
  input.Name = strings.TrimSpace(input.Name)
  if input.Name == "" || utf8.RuneCountInString(input.Name) > 48 { http.Error(w, "room name must contain 1–48 characters", http.StatusBadRequest); return }
  room := Room{ID: newID(), Name: input.Name, Kind: "text"}
  s.mu.Lock()
  s.rooms = append(s.rooms, room)
  s.mu.Unlock()
  jsonReply(w, http.StatusCreated, room)
}

func (s *Server) roomExists(id string) bool {
  for _, room := range s.rooms { if room.ID == id { return true } }
  return false
}

func (s *Server) roomRoute(w http.ResponseWriter, r *http.Request) {
  parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/rooms/"), "/")
  if len(parts) != 2 || parts[0] == "" {
    http.NotFound(w, r); return
  }
  id := parts[0]
  s.mu.RLock()
  exists := s.roomExists(id)
  s.mu.RUnlock()
  if !exists { http.NotFound(w, r); return }
  switch {
  case parts[1] == "messages" && r.Method == http.MethodGet:
    s.listMessages(w, id)
  case parts[1] == "messages" && r.Method == http.MethodPost:
    s.sendMessage(w, r, id)
  case parts[1] == "events" && r.Method == http.MethodGet:
    s.events(w, r, id)
  default:
    http.NotFound(w, r)
  }
}

func (s *Server) listMessages(w http.ResponseWriter, id string) {
  s.mu.RLock()
  messages := append([]Message{}, s.messages[id]...)
  s.mu.RUnlock()
  jsonReply(w, http.StatusOK, messages)
}

func (s *Server) sendMessage(w http.ResponseWriter, r *http.Request, id string) {
  var input struct {
    Author string `json:"author"`
    Text string `json:"text"`
  }
  if err := decodeJSON(r, &input); err != nil { http.Error(w, err.Error(), http.StatusBadRequest); return }
  author := strings.TrimSpace(input.Author)
  messageText := strings.TrimSpace(input.Text)
  if author == "" || utf8.RuneCountInString(author) > 32 { http.Error(w, "author must contain 1–32 characters", http.StatusBadRequest); return }
  if messageText == "" || utf8.RuneCountInString(messageText) > 2000 { http.Error(w, "message must contain 1–2000 characters", http.StatusBadRequest); return }
  message := Message{ID: newID(), RoomID: id, Author: author, Text: messageText, CreatedAt: time.Now().UTC()}
  s.mu.Lock()
  s.messages[id] = append(s.messages[id], message)
  if len(s.messages[id]) > 100 { s.messages[id] = append([]Message{}, s.messages[id][len(s.messages[id])-100:]...) }
  for subscriber := range s.subscribers[id] {
    select { case subscriber <- message: default: }
  }
  s.mu.Unlock()
  jsonReply(w, http.StatusCreated, message)
}

func (s *Server) events(w http.ResponseWriter, r *http.Request, id string) {
  flusher, ok := w.(http.Flusher)
  if !ok { http.Error(w, "streaming unsupported", http.StatusInternalServerError); return }
  w.Header().Set("Content-Type", "text/event-stream")
  w.Header().Set("Cache-Control", "no-cache, no-transform")
  w.Header().Set("X-Accel-Buffering", "no")
  subscriber := make(chan Message, 32)
  s.mu.Lock()
  if s.subscribers[id] == nil { s.subscribers[id] = make(map[chan Message]struct{}) }
  s.subscribers[id][subscriber] = struct{}{}
  s.mu.Unlock()
  defer func() {
    s.mu.Lock()
    delete(s.subscribers[id], subscriber)
    s.mu.Unlock()
  }()
  _, _ = fmt.Fprintln(w, ": connected")
  _, _ = fmt.Fprintln(w)
  flusher.Flush()
  ticker := time.NewTicker(20 * time.Second)
  defer ticker.Stop()
  for {
    select {
    case <-r.Context().Done(): return
    case msg := <-subscriber:
      data, err := json.Marshal(msg)
      if err != nil { continue }
      if _, err := fmt.Fprintf(w, "event: message%vdata: %s%v%v", string([]byte{10}), data, string([]byte{10}), string([]byte{10})); err != nil { return }
      flusher.Flush()
    case <-ticker.C:
      if _, err := fmt.Fprintln(w, ": ping"); err != nil { return }
      if _, err := fmt.Fprintln(w); err != nil { return }
      flusher.Flush()
    }
  }
}
