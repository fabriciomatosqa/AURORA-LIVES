package server

import (
  "bytes"
  "encoding/json"
  "net/http"
  "net/http/httptest"
  "testing"
)

func request(t *testing.T, h http.Handler, method, path, payload string) *httptest.ResponseRecorder {
  t.Helper()
  req := httptest.NewRequest(method, path, bytes.NewBufferString(payload))
  if payload != "" { req.Header.Set("Content-Type", "application/json") }
  rr := httptest.NewRecorder()
  h.ServeHTTP(rr, req)
  return rr
}

func TestHealthAndRooms(t *testing.T) {
  h := New().Handler()
  if rr := request(t, h, "GET", "/api/health", ""); rr.Code != 200 { t.Fatalf("health = %d", rr.Code) }
  rr := request(t, h, "GET", "/api/rooms", "")
  var rooms []Room
  if err := json.Unmarshal(rr.Body.Bytes(), &rooms); err != nil || len(rooms) != 2 { t.Fatalf("unexpected rooms %s: %v", rr.Body.String(), err) }
}

func TestCreateRoomAndMessages(t *testing.T) {
  h := New().Handler()
  rr := request(t, h, "POST", "/api/rooms", `{"name":"Sala de testes"}`)
  if rr.Code != 201 { t.Fatalf("create room = %d: %s", rr.Code, rr.Body.String()) }
  var room Room
  if err := json.Unmarshal(rr.Body.Bytes(), &room); err != nil || room.ID == "" { t.Fatal("missing created room", err) }
  path := "/api/rooms/" + room.ID + "/messages"
  rr = request(t, h, "POST", path, `{"author":"Ana","text":"Olá AURORA!"}`)
  if rr.Code != 201 { t.Fatalf("send = %d: %s", rr.Code, rr.Body.String()) }
  rr = request(t, h, "GET", path, "")
  var messages []Message
  if err := json.Unmarshal(rr.Body.Bytes(), &messages); err != nil || len(messages) != 1 || messages[0].Text != "Olá AURORA!" { t.Fatalf("messages = %s: %v", rr.Body.String(), err) }
}

func TestValidationAndOrigin(t *testing.T) {
  h := New().Handler()
  for _, payload := range []string{
    `{"name":""}`, `{"name":"    "}`, `{"name":"ok","privileged":true}`,
  } {
    rr := request(t, h, "POST", "/api/rooms", payload)
    if rr.Code != 400 { t.Fatalf("payload %s returned %d", payload, rr.Code) }
  }
  if rr := request(t, h, "POST", "/api/rooms/geral/messages", `{"author":"Ana","text":"   "}`); rr.Code != 400 { t.Fatal("accepted blank message") }
  if rr := request(t, h, "GET", "/api/rooms/nope/messages", ""); rr.Code != 404 { t.Fatal("missing room should be 404") }
  req := httptest.NewRequest("GET", "/api/health", nil)
  req.Header.Set("Origin", "https://untrusted.example")
  rr := httptest.NewRecorder()
  h.ServeHTTP(rr, req)
  if rr.Code != 403 { t.Fatalf("unexpected origin response %d", rr.Code) }
}

func TestMessageLimit(t *testing.T) {
  h := New().Handler()
  rr := request(t, h, "POST", "/api/rooms/geral/messages", `{"author":"Ana","text":"hello"}`)
  if rr.Code != 201 { t.Fatal(rr.Body.String()) }
  rr = request(t, h, "GET", "/api/rooms/geral/messages", "")
  var messages []Message
  if err := json.Unmarshal(rr.Body.Bytes(), &messages); err != nil || len(messages) != 1 { t.Fatal(err) }
}
