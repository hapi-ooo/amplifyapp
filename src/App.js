import React, { useState, useEffect } from "react";
import "./App.css";
import "@aws-amplify/ui-react/styles.css";
import { API, Storage, Auth } from "aws-amplify";
import {
  withAuthenticator,
  Button,
  Flex,
  Text,
  TextField,
  Heading,
  View,
  Image,
} from "@aws-amplify/ui-react";
import { listNotes } from "./graphql/queries";
import {
  createNote as createNoteMutation,
  deleteNote as deleteNoteMutation,
} from "./graphql/mutations";

const App = ({ signOut }) => {
  const [notes, setNotes] = useState([]);
  const [user, setUser] = useState('');

  useEffect(() => {
    fetchNotes();
    getUser();
  }, []);

  async function getUser() {
    const userInfo = await Auth.currentUserInfo();
    setUser(userInfo.username);
  }

  async function fetchNotes() {
    const apiData = await API.graphql({ 
      query: listNotes,
      authMode: "AMAZON_COGNITO_USER_POOLS",
    });
    const notesFromAPI = apiData.data.listNotes.items;
    await Promise.all(
      notesFromAPI.map(async (note) => {
        console.log(note);
        if (note.image) {
          const url = await Storage.get(note.image);
          note.imagesrc = url;
        }
        return note;
      })
    );
    setNotes(notesFromAPI);
  }

  function randomS3Key() {
    return String(Math.floor(Math.random() * 9e20));
  }

  async function createNote(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    const image = form.get("image");
    const data = {
      name: form.get("name"),
      description: form.get("description"),
      image: image.name,
    };
    if (!!data.image) {
      data.image =  user + '-' + randomS3Key() + data.image;
      await Storage.put(data.image, image);
    }
    await API.graphql({
      query: createNoteMutation,
      variables: { input: data },
      authMode: "AMAZON_COGNITO_USER_POOLS",
    });
    fetchNotes();
    event.target.reset();
  }

  async function deleteNote({ id, image }) {
    const newNotes = notes.filter((note) => note.id !== id);
    setNotes(newNotes);
    console.log(image);
    await Storage.remove(image);
    await API.graphql({
      query: deleteNoteMutation,
      variables: { input: { id } },
      authMode: "AMAZON_COGNITO_USER_POOLS",
    });
  }

  return (
    <View className = "App">
      <Heading level={1}>My Notes App</Heading>
      <View as="form" margin="3rem 0" onSubmit={createNote}>
        <Flex direction="row" justifyContent="center">
          <TextField
            name="name"
            placeholder="Note Name"
            label="Note Name"
            labelHidden
            variation="quiet"
            required
          />
          <TextField
            name="description"
            placeholder="Note Description"
            label="Note Description"
            labelHidden
            variation="quiet"
            required
          />
          <View
            name="image"
            as="input"
            type="file"
            style={{ alignSelf: "end" }}
          />
          <Button type="submit" variation="primary" disabled={!user}>
            Create Note
          </Button>
        </Flex>
      </View>
      <Heading level={2}>Current Notes</Heading>
      <View margin="3rem 0">
        {notes.map((note) => (
          <Flex
            key={note.id || note.name}
            direction="row"
            justifyContent="center"
            alignItems="center"
          >
            <Text as="strong" fontWeight={700} color="green">
              {note.owner}
            </Text>
            <Text as="strong" fontWeight={700}>
              {note.name}
            </Text>
            <Text as="span">{note.description}</Text>
            {note.image && (
              <Image
                src={note.imagesrc}
                alt={`visual aid for ${notes.name}`}
                style={{ width: 100 }}
              />
            )}
            <Button variation="link" onClick={()=>deleteNote(note)}>
              Delete Note
            </Button>
          </Flex>
        ))}
      </View>
      <Button onClick={signOut}>Sign Out</Button>
    </View>
  );
};

export default withAuthenticator(App);