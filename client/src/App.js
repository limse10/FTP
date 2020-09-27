import React, { Component } from "react";
import "./App.css";
import downloadIcon from "./assets/download.svg";
const api = "http://localhost:3000/";
const ftp = "ftp://localhost/";

class Header extends Component {
  render() {
    return <div class="Header">File Server!</div>;
  }
}

class SearchBox extends Component {
  state = { value: "", searchType: "AND" };

  handleChange = this.handleChange.bind(this);
  handleSubmit = this.handleSubmit.bind(this);
  handleQueryChange = this.handleQueryChange.bind(this);
  handleChange(event) {
    this.setState({ value: event.target.value });
  }

  handleSubmit(event) {
    if (this.state.value.trim() === "" || this.state.searchType === "") {
      this.props.updater(null);
    } else {
      this.props.updater(
        this.state.value.split(",").map((tag) => {
          return tag.trim();
        }),
        this.state.searchType
      );
    }
    if (event) {
      event.preventDefault();
    }
  }
  handleQueryChange(event) {
    let st = event.target.value;
    this.setState({ searchType: st }, () => {
      this.handleSubmit();
    });
  }
  render() {
    return (
      <form class="SearchBoxContainer" onSubmit={this.handleSubmit}>
        <input
          class="SearchBox"
          type="text"
          value={this.state.value}
          onChange={this.handleChange}
          placeholder="filter by tags"
        />
        <div onChange={this.handleQueryChange}>
          <input type="radio" value="AND" name="type" />
          AND
          <input type="radio" value="OR" name="type" /> OR
        </div>
      </form>
    );
  }
}

class Tag extends Component {
  removeTag() {
    let file_id = this.props.file_id;
    let tag_id = this.props.tag_id;
    fetch(api + `db/removeTag?file_id=${file_id}&tag_id=${tag_id}`);
  }
  render() {
    return (
      <div class="Tag">
        <div class="tagname">{this.props.name}</div>
        <div
          class="tag-remove"
          onClick={() => {
            this.removeTag();
          }}
        />
      </div>
    );
  }
}
class TagAdder extends Component {
  handleChange = this.handleChange.bind(this);
  handleSubmit = this.handleSubmit.bind(this);
  state = { value: "", id: this.props.id };
  handleChange(event) {
    this.setState({ value: event.target.value });
  }
  handleSubmit(event) {
    fetch(api + `db/addTag?file_id=${this.state.id}&tag=${this.state.value}`);
    event.preventDefault();
  }
  render() {
    return (
      <form onSubmit={this.handleSubmit}>
        <input
          class="tagAdder"
          type="text"
          value={this.state.value}
          onChange={this.handleChange}
          placeholder="Add Tag"
        />
      </form>
    );
  }
}
class ItemExpanded extends Component {
  state = { data: this.props.item };
  async componentDidMount() {
    const response = await fetch(api + `db/getTags?id=${this.state.data.id}`);
    const data = await response.json();
    this.setState({
      tags: data.map((obj) => {
        return { name: obj.name, id: obj.id };
      }),
    });
  }

  render() {
    let tags;
    if (this.state.tags) {
      tags = this.state.tags.map((tag) => {
        return (
          <Tag name={tag.name} tag_id={tag.id} file_id={this.state.data.id} />
        );
      });
    }
    return (
      <div>
        <div>{this.state.data.id}</div>
        <div>{this.state.data.type}</div>
        <div class="tagContainer">{this.state.tags ? tags : null}</div>
        <TagAdder id={this.state.data.id} />
      </div>
    );
  }
}

class Item extends Component {
  state = { expanded: false, loading: false };

  async downloadItem(id) {
    switch (this.props.item.type) {
      case "f":
        window.location.assign(ftp + this.props.item.path);
        break;
      case "d":
        this.setState({ loading: true });
        const url = encodeURI(api + `ftp/zip?dir=${this.props.item.path}`);
        let response = await fetch(url);
        let downloadLink = await response.text();
        this.setState({ loading: false });
        window.location.assign(api + downloadLink);

        break;
      default:
        break;
    }
  }
  expand(e) {
    if (e.target === e.currentTarget) {
      this.setState({ expanded: !this.state.expanded });
    }
  }

  render() {
    return (
      <div class="Item" key={this.props.item} onClick={(e) => this.expand(e)}>
        <div
          class="name"
          onClick={(e) => this.expand(e)}
          data-title={this.props.item.path}
        >
          {this.props.item.path}
        </div>

        <img
          class="download"
          src={downloadIcon}
          alt="download"
          onClick={() => this.downloadItem(this.props.item.id)}
        />
        {this.state.loading ? <div class="spinner" /> : null}

        {this.state.expanded ? <ItemExpanded item={this.props.item} /> : null}
      </div>
    );
  }
}
class Tools extends Component {
  syncDB() {
    fetch(api + "db/sync");
  }
  assignTags() {}
  render() {
    return (
      <div>
        <button onClick={() => this.syncDB()}>synchronise DB</button>
        <button onClick={() => this.assignTags()}>Assign Tags</button>
      </div>
    );
  }
}
class App extends Component {
  state = {
    all_items: [],
    items: [],
  };
  updateItems = this.updateItems.bind(this);
  async componentDidMount() {
    const response = await fetch(api + "db/list");
    const data = await response.json();
    this.setState({ all_items: data, items: data });
  }
  async updateItems(data, searchType) {
    if (!data) {
      this.setState({ items: this.state.all_items });
    } else {
      let taglist = data;

      const res = await (
        await fetch(
          api + `db/filter?taglist=${taglist}&searchType=${searchType}`
        )
      ).json();

      this.setState({ items: res });
    }
  }
  render() {
    let items = this.state.items.map((item) => {
      return <Item item={item} />;
    });
    return (
      <div class="App">
        <Header />
        <Tools />
        <SearchBox updater={this.updateItems} />
        <div class="ItemContainer">{items}</div>
      </div>
    );
  }
}

export default App;
